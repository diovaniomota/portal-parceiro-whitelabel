import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerPortalUser } from '@/app/lib/serverSupabase';

const CLIENT_SELECT = 'id, name, razao_social, nome_fantasia, cnpj, email, phone, plan_code, plan_name, plan, status, situacao, blocked_reason, created_at, partner_id, account_channel, partner_client_code, white_label_settings, inscricao_estadual, cnae_principal, cep, logradouro, numero, bairro, cidade, uf, cod_ibge, segment, system, enable_tablet, enabled_features';

const PLAN_ALIAS: Record<string, string> = {
  evolucao: 'prime',
  escala: 'prime',
  performance: 'prime',
  basico: 'essencial',
  básico: 'essencial',
  basic: 'essencial',
  profissional: 'prime',
  professional: 'prime',
  enterprise: 'prime'
};

const DEFAULT_PLAN_NAMES: Record<string, string> = {
  essencial: 'Essencial',
  prime: 'Prime'
};

const normalizeText = (value: unknown) => {
  const text = String(value || '').trim();
  return text || null;
};

const normalizeLower = (value: unknown) => String(value || '').trim().toLowerCase();

const normalizePlanCode = (value: unknown) => {
  const normalized = normalizeLower(value);
  return PLAN_ALIAS[normalized] || normalized || 'essencial';
};

const normalizeFeatureList = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );
};

const toBoolean = (value: unknown) => value === true || value === 'true' || value === 1 || value === '1';

const normalizeOrganizationStatus = (value: unknown) => {
  const normalized = normalizeLower(value);
  if (normalized === 'blocked' || normalized === 'bloqueado') return 'bloqueado';
  if (normalized === 'inactive' || normalized === 'inativo') return 'inativo';
  if (normalized === 'vencido' || normalized === 'overdue') return 'vencido';
  return 'ativo';
};

const createGeneratedPassword = () => {
  const random = Math.random().toString(36).slice(2, 10);
  return `Dart@${random}${Date.now().toString().slice(-4)}`;
};

async function findAuthUserByEmail(supabaseAdmin: any, email: string) {
  const targetEmail = normalizeLower(email);
  if (!targetEmail) return null;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000
    });

    if (error) return null;

    const found = (data?.users || []).find((item: any) => normalizeLower(item?.email) === targetEmail);
    if (found) return found;
    if ((data?.users || []).length < 1000) return null;
  }

  return null;
}

async function createOrFindAuthUser(
  supabaseAdmin: any,
  input: { email?: string | null; password?: string | null; name?: string | null; role: string; partnerId: string; organizationId: string }
) {
  const email = normalizeText(input.email);
  if (!email) return { authId: null, tempPassword: null, reused: false };

  const existing = await findAuthUserByEmail(supabaseAdmin, email);
  if (existing?.id) {
    return { authId: existing.id, tempPassword: null, reused: true };
  }

  const tempPassword = normalizeText(input.password) || createGeneratedPassword();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      name: input.name || email,
      role: input.role,
      partner_id: input.partnerId,
      organization_id: input.organizationId
    }
  });

  if (error) throw new Error(error.message || 'Não foi possível criar usuário.');
  return { authId: data?.user?.id || null, tempPassword, reused: false };
}

async function upsertAppUser(supabaseAdmin: any, payload: Record<string, unknown>) {
  if (!payload.auth_id) return null;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('auth_id', payload.auth_id)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from('app_users')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (error) throw new Error(error.message);
    return existing;
  }

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .insert([payload])
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function upsertMembership(supabaseAdmin: any, payload: Record<string, unknown>) {
  if (!payload.auth_id || !payload.organization_id) return null;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('user_company_memberships')
    .select('id')
    .eq('auth_id', payload.auth_id)
    .eq('organization_id', payload.organization_id)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from('user_company_memberships')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (error) throw new Error(error.message);
    return existing;
  }

  const { data, error } = await supabaseAdmin
    .from('user_company_memberships')
    .insert([payload])
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePartnerPortalUser(request);
    if (!auth.ok) return auth.response;

    const [clientsResult, plansResult, segmentsResult] = await Promise.all([
      auth.supabaseAdmin
        .from('organizations')
        .select(CLIENT_SELECT)
        .eq('partner_id', auth.partner.id)
        .order('created_at', { ascending: false }),
      auth.supabaseAdmin
        .from('plans')
        .select('code, name, features, max_users, max_data_bytes, max_storage_bytes, max_imports_per_month, sort_order')
        .order('sort_order', { ascending: true }),
      auth.supabaseAdmin
        .from('business_segments')
        .select('key, label, description, default_features, features_per_plan, active, sort_order')
        .eq('active', true)
        .order('sort_order', { ascending: true })
    ]);

    if (clientsResult.error) {
      return NextResponse.json({ success: false, error: clientsResult.error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      partner: auth.partner,
      clients: clientsResult.data || [],
      plans: plansResult.error ? [] : (plansResult.data || []),
      segments: segmentsResult.error ? [] : (segmentsResult.data || [])
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro interno.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePartnerPortalUser(request);
    if (!auth.ok) return auth.response;

    if (auth.partner.portal_enabled === false) {
      return NextResponse.json({ success: false, error: 'Portal desabilitado pela plataforma.' }, { status: 403 });
    }

    if (auth.partner.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Parceiro bloqueado pela plataforma.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const id = normalizeText(body.id);
    const name =
      normalizeText(body.name) ||
      normalizeText(body.nomeFantasia) ||
      normalizeText(body.fantasyName) ||
      normalizeText(body.razaoSocial) ||
      normalizeText(body.legalName);

    if (!name) {
      return NextResponse.json({ success: false, error: 'Nome do cliente é obrigatório.' }, { status: 400 });
    }

    const status = normalizeOrganizationStatus(body.status);
    const planCode = normalizePlanCode(body.plan || body.planCode);
    const planName = normalizeText(body.planName) || DEFAULT_PLAN_NAMES[planCode] || planCode;
    const selectedSystem = normalizeLower(body.system) === 'food' ? 'food' : 'work';
    const enabledFeatures = normalizeFeatureList(body.enabledFeatures);
    const organizationPayload = {
      name,
      nome_fantasia: normalizeText(body.nomeFantasia) || normalizeText(body.fantasyName) || name,
      razao_social: normalizeText(body.razaoSocial) || normalizeText(body.legalName) || name,
      cnpj: normalizeText(body.cnpj) || normalizeText(body.document),
      email: normalizeText(body.email),
      phone: normalizeText(body.phone),
      inscricao_estadual: normalizeText(body.inscricaoEstadual),
      cnae_principal: normalizeText(body.cnaePrincipal),
      cep: normalizeText(body.cep),
      logradouro: normalizeText(body.logradouro),
      numero: normalizeText(body.numero),
      bairro: normalizeText(body.bairro),
      cidade: normalizeText(body.cidade),
      uf: normalizeText(body.uf),
      cod_ibge: normalizeText(body.codIbge),
      plan: planCode,
      plan_code: planCode,
      plan_name: planName,
      status,
      situacao: status,
      segment: normalizeText(body.segment),
      system: selectedSystem,
      enable_tablet: selectedSystem === 'food' ? toBoolean(body.enableTablet) : false,
      enabled_features: enabledFeatures,
      partner_id: auth.partner.id,
      account_channel: 'partner',
      partner_client_code: normalizeText(body.clientCode),
      white_label_settings: {
        partner_id: auth.partner.id,
        brand_name: auth.partner.name,
        logo_url: auth.partner.logo_url || null,
        primary_color: auth.partner.primary_color || '#2961b2',
        logo_layout: auth.partner.metadata?.logo_layout || null,
        database_mode: normalizeLower(body.databaseMode) === 'cloud' ? 'cloud' : 'local'
      }
    };

    let organization;
    if (id) {
      const { data, error } = await auth.supabaseAdmin
        .from('organizations')
        .update(organizationPayload)
        .eq('id', id)
        .eq('partner_id', auth.partner.id)
        .select(CLIENT_SELECT)
        .single();

      if (error) throw new Error(error.message);
      organization = data;
    } else {
      const { data, error } = await auth.supabaseAdmin
        .from('organizations')
        .insert([organizationPayload])
        .select(CLIENT_SELECT)
        .single();

      if (error) throw new Error(error.message);
      organization = data;
    }

    let clientAccess = null;
    const isLocalMode = normalizeLower(body.databaseMode) === 'local';
    const adminEmail = normalizeText(body.adminEmail) || normalizeText(body.admin_email);
    if (adminEmail && !isLocalMode) {
      const adminName = normalizeText(body.adminName) || normalizeText(body.admin_name) || organization.name || adminEmail;
      const createdUser = await createOrFindAuthUser(auth.supabaseAdmin, {
        email: adminEmail,
        password: normalizeText(body.adminPassword) || normalizeText(body.admin_password),
        name: adminName,
        role: 'admin',
        partnerId: auth.partner.id,
        organizationId: organization.id
      });

      if (createdUser.authId) {
        await upsertAppUser(auth.supabaseAdmin, {
          auth_id: createdUser.authId,
          name: adminName,
          email: adminEmail,
          role: 'admin',
          partner_id: auth.partner.id,
          account_type: 'client',
          organization_id: organization.id,
          active_organization_id: organization.id,
          permissions: null
        });

        await upsertMembership(auth.supabaseAdmin, {
          auth_id: createdUser.authId,
          organization_id: organization.id,
          role: 'admin',
          status: 'active',
          is_primary: true,
          permissions: null,
          business_group_id: null,
          profile_id: null
        });

        await auth.supabaseAdmin
          .from('organizations')
          .update({ admin_user_id: createdUser.authId })
          .eq('id', organization.id);

        clientAccess = {
          email: adminEmail,
          tempPassword: createdUser.tempPassword,
          reused: createdUser.reused
        };
      }
    }

    return NextResponse.json({ success: true, organization, clientAccess });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao salvar cliente.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requirePartnerPortalUser(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const organizationId = normalizeText(body.organizationId);
    const status = normalizeOrganizationStatus(body.status);

    if (!organizationId) {
      return NextResponse.json({ success: false, error: 'Cliente inválido.' }, { status: 400 });
    }

    const { data, error } = await auth.supabaseAdmin
      .from('organizations')
      .update({
        status,
        situacao: status,
        blocked_reason: status === 'bloqueado'
          ? (normalizeText(body.reason) || 'Cliente bloqueado pelo parceiro.')
          : null
      })
      .eq('id', organizationId)
      .eq('partner_id', auth.partner.id)
      .select(CLIENT_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, organization: data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao atualizar cliente.' },
      { status: 500 }
    );
  }
}
