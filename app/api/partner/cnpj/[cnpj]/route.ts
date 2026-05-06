import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerPortalUser } from '@/app/lib/serverSupabase';

const onlyDigits = (value: unknown) => String(value || '').replace(/\D/g, '');

const normalizeText = (value: unknown) => {
  const text = String(value || '').trim();
  return text || null;
};

const isValidCnpj = (value: string) => {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calculateDigit = (base: string, weights: number[]) => {
    const sum = base
      .split('')
      .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const firstDigit = calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return cnpj.endsWith(`${firstDigit}${secondDigit}`);
};

const fetchJson = async (url: string) => {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 60 * 60 * 24 }
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
};

const mapBrasilApiCompany = (data: any, cnpjDigits: string) => ({
  cnpj: normalizeText(data?.cnpj) || cnpjDigits,
  razao_social: normalizeText(data?.razao_social),
  nome_fantasia: normalizeText(data?.nome_fantasia),
  email: normalizeText(data?.email),
  phone: normalizeText(data?.ddd_telefone_1) || normalizeText(data?.ddd_telefone_2),
  cnae_principal: normalizeText(data?.cnae_fiscal_descricao),
  cep: normalizeText(data?.cep),
  logradouro: normalizeText(data?.logradouro),
  numero: normalizeText(data?.numero),
  bairro: normalizeText(data?.bairro),
  cidade: normalizeText(data?.municipio),
  uf: normalizeText(data?.uf)
});

const mapCnpjWsCompany = (data: any, cnpjDigits: string) => {
  const establishment = data?.estabelecimento || {};
  const city = establishment?.cidade || {};
  const state = establishment?.estado || {};
  const activity = establishment?.atividade_principal || {};
  const phone = [establishment?.ddd1, establishment?.telefone1]
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(' ');
  const street = [establishment?.tipo_logradouro, establishment?.logradouro]
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(' ');

  return {
    cnpj: normalizeText(establishment?.cnpj) || cnpjDigits,
    razao_social: normalizeText(data?.razao_social),
    nome_fantasia: normalizeText(establishment?.nome_fantasia),
    email: normalizeText(establishment?.email),
    phone: normalizeText(phone),
    cnae_principal: normalizeText(activity?.descricao),
    cep: normalizeText(establishment?.cep),
    logradouro: normalizeText(street),
    numero: normalizeText(establishment?.numero),
    bairro: normalizeText(establishment?.bairro),
    cidade: normalizeText(city?.nome),
    uf: normalizeText(state?.sigla)
  };
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cnpj: string }> }
) {
  try {
    const auth = await requirePartnerPortalUser(request);
    if (!auth.ok) return auth.response;

    const { cnpj } = await params;
    const cnpjDigits = onlyDigits(cnpj);

    if (!isValidCnpj(cnpjDigits)) {
      return NextResponse.json(
        { success: false, error: 'CNPJ inválido. Confira os dígitos informados.' },
        { status: 400 }
      );
    }

    const brasilApi = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`);
    if (brasilApi.response.ok) {
      return NextResponse.json({ success: true, company: mapBrasilApiCompany(brasilApi.data, cnpjDigits) });
    }

    const cnpjWs = await fetchJson(`https://publica.cnpj.ws/cnpj/${cnpjDigits}`);
    if (cnpjWs.response.ok) {
      return NextResponse.json({ success: true, company: mapCnpjWsCompany(cnpjWs.data, cnpjDigits) });
    }

    return NextResponse.json(
      { success: false, error: 'CNPJ não encontrado nas bases públicas consultadas.' },
      { status: 404 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao consultar CNPJ.' },
      { status: 500 }
    );
  }
}
