'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  Calculator,
  CreditCard,
  Edit,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Tablet,
  TrendingUp,
  Unlock,
  User,
  UsersRound,
  Utensils,
  Wallet,
  X,
  type LucideIcon
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabaseClient';
import styles from './page.module.css';

type Partner = {
  id: string;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  status?: string | null;
  blocked_reason?: string | null;
  license_price?: number | string | null;
  monthly_fee?: number | string | null;
};

type PartnerClient = {
  id: string;
  name?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  plan_code?: string | null;
  plan_name?: string | null;
  plan?: string | null;
  status?: string | null;
  partner_client_code?: string | null;
  inscricao_estadual?: string | null;
  cnae_principal?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cod_ibge?: string | null;
  segment?: string | null;
  system?: string | null;
  enable_tablet?: boolean | null;
  enabled_features?: string[] | null;
};

type PlanOption = {
  code: string;
  name: string;
  features?: string[] | null;
};

type SegmentOption = {
  key: string;
  label: string;
  description?: string | null;
  default_features?: string[];
  features_per_plan?: Record<string, string[]>;
};

type FeatureItem = {
  key: string;
  label: string;
  category: string;
};

type ActiveView = 'dashboard' | 'clients' | 'repasse';

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

const normalizePlanCode = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  return PLAN_ALIAS[normalized] || normalized || 'essencial';
};

const normalizeList = (values: unknown) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );

const PLAN_FEATURES: Record<string, string[]> = {
  essencial: normalizeList([
    'dashboard',
    'ordens_servico',
    'pdv',
    'caixa',
    'fluxo_caixa',
    'clientes',
    'produtos',
    'contas_pagar',
    'contas_receber',
    'indicacoes',
    'configuracoes'
  ]),
  prime: normalizeList([
    'dashboard',
    'clientes',
    'produtos',
    'fornecedores',
    'funcionarios_vendedores',
    'transportadoras',
    'veiculos',
    'etiquetas',
    'compras',
    'cotacoes',
    'sugestao_compra',
    'estoque',
    'estoque_saldos',
    'estoque_inventario',
    'estoque_depositos',
    'estoque_lotes',
    'documentos',
    'producao',
    'producao_expedicao',
    'producao_requisicao',
    'producao_pedidos',
    'ordens_servico',
    'pdv',
    'caixa',
    'fluxo_caixa',
    'vendas',
    'orcamentos',
    'romaneio',
    'nfe',
    'nfse',
    'nfce',
    'dfe',
    'marketplace',
    'contas_pagar',
    'contas_receber',
    'conciliacao_bancaria',
    'boletos',
    'automacoes',
    'financeiro',
    'financeiro_categorias',
    'cobrancas',
    'remessa_cnab',
    'relatorios',
    'financeiro_dre',
    'comissoes',
    'painel_financeiro',
    'dashboard_executivo',
    'visao_360',
    'impressao_etiquetas',
    'impressao_carne',
    'impressao_ordem_servico',
    'configuracoes',
    'equipe',
    'assistente_ia',
    'mobile_app',
    'acesso_remoto',
    'sugestoes',
    'indicacoes',
    'portal_conhecimento',
    'suporte_humano'
  ])
};

const DEFAULT_PLANS: PlanOption[] = [
  { code: 'essencial', name: 'Essencial', features: PLAN_FEATURES.essencial },
  { code: 'prime', name: 'Prime', features: PLAN_FEATURES.prime }
];

const DEFAULT_SEGMENTS: SegmentOption[] = [
  {
    key: 'comercio',
    label: 'Comércio',
    description: 'Lojas, varejos e distribuidoras',
    default_features: ['dashboard', 'pdv', 'nfce', 'nfe', 'produtos', 'estoque', 'clientes', 'caixa', 'fluxo_caixa']
  },
  {
    key: 'servicos',
    label: 'Serviços',
    description: 'Prestadores de serviço em geral',
    default_features: ['dashboard', 'ordens_servico', 'nfse', 'clientes', 'orcamentos', 'fluxo_caixa']
  },
  {
    key: 'oficina_auto',
    label: 'Oficina / Auto',
    description: 'Oficinas mecânicas e auto centers',
    default_features: ['dashboard', 'ordens_servico', 'veiculos', 'clientes', 'produtos', 'nfse']
  },
  {
    key: 'padaria',
    label: 'Padaria',
    description: 'Panificadoras e confeitarias',
    default_features: ['dashboard', 'pdv', 'nfce', 'producao', 'produtos', 'estoque', 'clientes']
  },
  { key: 'outro', label: 'Outro', description: 'Outros segmentos', default_features: [] }
];

const FEATURE_CATALOG: FeatureItem[] = [
  { key: 'clientes', label: 'Clientes', category: 'Cadastros' },
  { key: 'produtos', label: 'Produtos / Estoque', category: 'Cadastros' },
  { key: 'fornecedores', label: 'Fornecedores', category: 'Cadastros' },
  { key: 'funcionarios_vendedores', label: 'Vendedores', category: 'Cadastros' },
  { key: 'veiculos', label: 'Veículos', category: 'Cadastros' },
  { key: 'etiquetas', label: 'Etiquetas', category: 'Cadastros' },
  { key: 'compras', label: 'Entradas', category: 'Compras' },
  { key: 'cotacoes', label: 'Cotações', category: 'Compras' },
  { key: 'estoque', label: 'Movimento', category: 'Estoque' },
  { key: 'estoque_inventario', label: 'Inventário', category: 'Estoque' },
  { key: 'estoque_lotes', label: 'Lotes e Validade', category: 'Estoque' },
  { key: 'producao', label: 'Produção', category: 'Produção' },
  { key: 'ordens_servico', label: 'Ordens de Serviço', category: 'Serviços' },
  { key: 'pdv', label: 'Vendas / PDV', category: 'Faturamento' },
  { key: 'caixa', label: 'Caixa', category: 'Faturamento' },
  { key: 'vendas', label: 'Consultar Vendas', category: 'Faturamento' },
  { key: 'orcamentos', label: 'Orçamentos', category: 'Faturamento' },
  { key: 'nfe', label: 'NF-e', category: 'Faturamento' },
  { key: 'nfse', label: 'NFS-e', category: 'Faturamento' },
  { key: 'nfce', label: 'NFC-e', category: 'Faturamento' },
  { key: 'cardapio_tablet', label: 'Cardápio Tablet', category: 'Food / Restaurante' },
  { key: 'pedidos_mesa', label: 'Pedidos Mesa', category: 'Food / Restaurante' },
  { key: 'receitas', label: 'Receitas', category: 'Food / Restaurante' },
  { key: 'contas_pagar', label: 'Contas a Pagar', category: 'Financeiro' },
  { key: 'contas_receber', label: 'Contas a Receber', category: 'Financeiro' },
  { key: 'conciliacao_bancaria', label: 'Conciliação Bancária', category: 'Financeiro' },
  { key: 'boletos', label: 'Boletos', category: 'Financeiro' },
  { key: 'relatorios', label: 'Relatórios', category: 'Relatórios' },
  { key: 'financeiro_dre', label: 'DRE Gerencial', category: 'Relatórios' },
  { key: 'dashboard_executivo', label: 'Dashboard Executivo', category: 'Relatórios' },
  { key: 'configuracoes', label: 'Configurações', category: 'Sistema' },
  { key: 'equipe', label: 'Equipe', category: 'Sistema' },
  { key: 'assistente_ia', label: 'Assistente IA', category: 'Sistema' }
];

const initialForm = {
  id: '',
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  email: '',
  phone: '',
  plan: 'essencial',
  inscricaoEstadual: '',
  cnaePrincipal: '',
  cep: '',
  logradouro: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
  codIbge: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  clientCode: '',
  status: 'active',
  system: 'work' as 'work' | 'food',
  segment: '',
  enableTablet: true
};

const cleanFormat = (value: unknown) => String(value || '').replace(/\D/g, '');

const formatCNPJ = (value: unknown) => {
  return cleanFormat(value)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const formatPhone = (value: unknown) => {
  const digits = cleanFormat(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
};

const formatCEP = (value: unknown) => cleanFormat(value).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');

const formatCurrency = (value: unknown) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(value) || 0);

const toMoneyNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function hexToRgba(hex?: string | null, alpha = 0.15) {
  const normalized = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return '';
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const normalizeStatus = (value?: string | null) => String(value || '').trim().toLowerCase();

const getStatusBadge = (status?: string | null) => {
  const normalized = normalizeStatus(status);
  if (normalized === 'ativo' || normalized === 'active') return { className: 'badgeSuccess', label: 'Ativo' };
  if (normalized === 'bloqueado' || normalized === 'blocked') return { className: 'badgeDanger', label: 'Bloqueado' };
  if (normalized === 'vencido' || normalized === 'overdue') return { className: 'badgeWarning', label: 'Vencido' };
  return { className: 'badgeDefault', label: 'Inativo' };
};

const getDefaultFeaturesForPlan = (planCode: unknown, plans: PlanOption[]) => {
  const normalized = normalizePlanCode(planCode);
  const dbPlan = plans.find((plan) => normalizePlanCode(plan.code) === normalized);
  if (Array.isArray(dbPlan?.features) && dbPlan.features.length > 0) {
    return normalizeList(dbPlan.features);
  }
  return PLAN_FEATURES[normalized] || PLAN_FEATURES.essencial;
};

const getSegmentFeatures = (segment: SegmentOption | undefined, planCode: string, planFeatures: string[]) => {
  if (!segment) return planFeatures;
  const perPlan = segment.features_per_plan?.[planCode];
  const segmentFeatures = Array.isArray(perPlan) && perPlan.length > 0
    ? perPlan
    : segment.default_features || [];

  if (segmentFeatures.length === 0) return planFeatures;
  const allowed = new Set(planFeatures);
  return normalizeList(segmentFeatures).filter((feature) => allowed.has(feature));
};

function FeaturePicker({
  enabledFeatures,
  onChange
}: {
  enabledFeatures: string[];
  onChange: (features: string[]) => void;
}) {
  const categories = Array.from(new Set(FEATURE_CATALOG.map((feature) => feature.category)));
  const toggle = (featureKey: string) => {
    if (enabledFeatures.includes(featureKey)) {
      onChange(enabledFeatures.filter((feature) => feature !== featureKey));
      return;
    }
    onChange([...enabledFeatures, featureKey]);
  };

  return (
    <div className={styles.featurePanel}>
      <div className={styles.featureSummary}>
        <div>
          <span className={styles.eyebrow}>Governança funcional</span>
          <strong>Capacidades ativas do cliente</strong>
        </div>
        <span>{enabledFeatures.length} recursos liberados</span>
      </div>
      {categories.map((category) => {
        const features = FEATURE_CATALOG.filter((feature) => feature.category === category);
        return (
          <section className={styles.featureCategory} key={category}>
            <div className={styles.featureCategoryTitle}>{category}</div>
            <div className={styles.featureGrid}>
              {features.map((feature) => {
                const active = enabledFeatures.includes(feature.key);
                return (
                  <button
                    type="button"
                    key={feature.key}
                    className={`${styles.featureCard} ${active ? styles.featureActive : ''}`}
                    onClick={() => toggle(feature.key)}
                  >
                    <span>{feature.label}</span>
                    <strong>{active ? 'Ativa' : 'Inativa'}</strong>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function PartnerHomePage() {
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [clients, setClients] = useState<PartnerClient[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>(DEFAULT_PLANS);
  const [segments, setSegments] = useState<SegmentOption[]>(DEFAULT_SEGMENTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingCnpj, setSearchingCnpj] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>(PLAN_FEATURES.essencial);
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const partnerBlocked = normalizeStatus(partner?.status) === 'blocked';
  const planOptions = plans.length > 0 ? plans : DEFAULT_PLANS;
  const segmentOptions = segments.length > 0 ? segments : DEFAULT_SEGMENTS;
  const selectedPlan = planOptions.find((plan) => normalizePlanCode(plan.code) === normalizePlanCode(form.plan)) || planOptions[0];
  const selectedPlanName = selectedPlan?.name || form.plan;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data?.session?.user) router.replace('/login');
    }).catch(() => router.replace('/login'));
  }, [router]);

  const getAccessToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || '';
  };

  const authorizedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getAccessToken();
    if (!token) {
      router.replace('/login');
      throw new Error('Sessão expirada.');
    }
    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {})
      }
    });
  }, [router]);

  const loadClients = useCallback(async () => {
    setLoading(true);

    try {
      const response = await authorizedFetch('/api/partner/clients');
      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload?.success) {
        setPartner(payload.partner || null);
        setClients(payload.clients || []);
        if (Array.isArray(payload.plans) && payload.plans.length > 0) {
          setPlans(payload.plans.map((plan: PlanOption) => ({ ...plan, code: normalizePlanCode(plan.code) })));
        }
        if (Array.isArray(payload.segments) && payload.segments.length > 0) {
          setSegments(payload.segments);
        }
        setMessage(null);
      } else {
        setMessage({ type: 'error', text: payload?.error || 'Não foi possível carregar os clientes.' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível carregar os clientes.' });
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useEffect(() => {
    const color = partner?.primary_color;
    const alpha = hexToRgba(color, 0.15);
    if (color && alpha) {
      document.documentElement.style.setProperty('--primary-color', color);
      document.documentElement.style.setProperty('--primary-color-alpha', alpha);
    }
  }, [partner?.primary_color]);

  const totals = useMemo(() => {
    return clients.reduce((acc, client) => {
      const status = normalizeStatus(client.status);
      acc.total += 1;
      if (status === 'ativo' || status === 'active') acc.active += 1;
      if (status === 'bloqueado' || status === 'blocked') acc.blocked += 1;
      if (status === 'vencido' || status === 'overdue') acc.overdue += 1;
      return acc;
    }, { total: 0, active: 0, blocked: 0, overdue: 0 });
  }, [clients]);

  const activeClients = useMemo(
    () => clients.filter((client) => ['ativo', 'active'].includes(normalizeStatus(client.status))),
    [clients]
  );

  const recentClients = useMemo(() => clients.slice(0, 5), [clients]);
  const licensePrice = useMemo(() => toMoneyNumber(partner?.license_price, 100), [partner?.license_price]);
  const monthlyRepasse = activeClients.length * licensePrice;

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => {
      const haystack = [
        client.name,
        client.nome_fantasia,
        client.razao_social,
        client.cnpj,
        client.email,
        client.phone,
        client.partner_client_code
      ].join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [clients, search]);

  const refreshFeaturesFor = (nextPlan: string, nextSegment = form.segment) => {
    const planCode = normalizePlanCode(nextPlan);
    const planFeatures = getDefaultFeaturesForPlan(planCode, planOptions);
    const segment = segmentOptions.find((item) => item.key === nextSegment);
    setEnabledFeatures(getSegmentFeatures(segment, planCode, planFeatures));
  };

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));

    if (field === 'plan') {
      refreshFeaturesFor(String(value));
    }

    if (field === 'segment') {
      refreshFeaturesFor(form.plan, String(value));
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    let nextValue = value;
    if (field === 'cnpj') nextValue = formatCNPJ(value);
    if (field === 'phone') nextValue = formatPhone(value);
    if (field === 'cep') nextValue = formatCEP(value);
    if (field === 'uf') nextValue = value.toUpperCase().slice(0, 2);
    updateField(field, nextValue);
  };

  const openNewForm = () => {
    setForm(initialForm);
    setStep(1);
    setShowForm(true);
    setActiveView('clients');
    setMessage(null);
    setEnabledFeatures(getDefaultFeaturesForPlan(initialForm.plan, planOptions));
  };

  const openEditForm = (client: PartnerClient) => {
    const planCode = normalizePlanCode(client.plan_code || client.plan || 'essencial');
    const features = normalizeList(client.enabled_features);
    setForm({
      id: client.id || '',
      razaoSocial: client.razao_social || client.name || '',
      nomeFantasia: client.nome_fantasia || client.name || '',
      cnpj: formatCNPJ(client.cnpj || ''),
      email: client.email || '',
      phone: formatPhone(client.phone || ''),
      plan: planCode,
      inscricaoEstadual: client.inscricao_estadual || '',
      cnaePrincipal: client.cnae_principal || '',
      cep: formatCEP(client.cep || ''),
      logradouro: client.logradouro || '',
      numero: client.numero || '',
      bairro: client.bairro || '',
      cidade: client.cidade || '',
      uf: client.uf || '',
      codIbge: client.cod_ibge || '',
      adminName: '',
      adminEmail: '',
      adminPassword: '',
      clientCode: client.partner_client_code || '',
      status: normalizeStatus(client.status) === 'bloqueado' ? 'blocked' : 'active',
      system: normalizeStatus(client.system) === 'food' ? 'food' : 'work',
      segment: client.segment || '',
      enableTablet: client.enable_tablet !== false
    });
    setEnabledFeatures(features.length > 0 ? features : getDefaultFeaturesForPlan(planCode, planOptions));
    setStep(1);
    setShowForm(true);
    setActiveView('clients');
    setMessage(null);
  };

  const fetchIbgeCode = async (uf: string, cityName: string) => {
    try {
      const response = await fetch(`https://brasilapi.com.br/api/ibge/municipios/v1/${uf}`);
      const cities = await response.json();
      const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const targetCity = normalize(cityName);
      const city = Array.isArray(cities) ? cities.find((item: any) => normalize(item.nome) === targetCity) : null;
      return city?.codigo_ibge || '';
    } catch {
      return '';
    }
  };

  const buscarCNPJ = async () => {
    const cnpjClean = cleanFormat(form.cnpj);
    if (cnpjClean.length !== 14) {
      setMessage({ type: 'error', text: 'CNPJ inválido. Informe 14 dígitos.' });
      return;
    }

    setSearchingCnpj(true);
    setMessage(null);

    try {
      const response = await authorizedFetch(`/api/partner/cnpj/${cnpjClean}`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        setMessage({ type: 'error', text: payload?.error || 'CNPJ não encontrado.' });
        return;
      }

      const data = payload.company || {};
      let ibgeCode = '';
      if (data.uf && data.cidade) {
        ibgeCode = await fetchIbgeCode(data.uf, data.cidade);
      }

      setForm((prev) => ({
        ...prev,
        cnpj: formatCNPJ(data.cnpj || cnpjClean),
        razaoSocial: data.razao_social || prev.razaoSocial,
        nomeFantasia: data.nome_fantasia || data.razao_social || prev.nomeFantasia,
        cnaePrincipal: data.cnae_principal || prev.cnaePrincipal,
        cep: formatCEP(data.cep || prev.cep),
        logradouro: data.logradouro || prev.logradouro,
        numero: data.numero || prev.numero,
        bairro: data.bairro || prev.bairro,
        cidade: data.cidade || prev.cidade,
        uf: data.uf || prev.uf,
        codIbge: ibgeCode || prev.codIbge,
        phone: formatPhone(data.phone || prev.phone),
        email: prev.email || data.email || ''
      }));
      setMessage({ type: 'success', text: 'Dados do CNPJ preenchidos.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Erro ao buscar CNPJ.' });
    } finally {
      setSearchingCnpj(false);
    }
  };

  const buscarCEP = async () => {
    const cepClean = cleanFormat(form.cep);
    if (cepClean.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepClean}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          uf: data.uf || prev.uf,
          codIbge: data.ibge || prev.codIbge
        }));
      }
    } catch {}
  };

  const validateStep = (targetStep: number) => {
    if (targetStep >= 2) {
      if (!form.cnpj || !form.razaoSocial || !form.nomeFantasia || !form.email) {
        setMessage({ type: 'error', text: 'Preencha CNPJ, razão social, nome fantasia e email antes de continuar.' });
        return false;
      }
    }

    if (targetStep >= 3) {
      if (!form.plan || !form.system || (!form.id && (!form.adminName || !form.adminEmail || !form.adminPassword))) {
        setMessage({ type: 'error', text: 'Preencha plano, sistema e os dados de acesso do admin.' });
        return false;
      }
    }

    setMessage(null);
    return true;
  };

  const goToStep = (nextStep: number) => {
    if (nextStep > step && !validateStep(nextStep)) return;
    setStep(nextStep);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateStep(3)) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await authorizedFetch('/api/partner/clients', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          name: form.nomeFantasia || form.razaoSocial,
          planName: selectedPlanName,
          enabledFeatures
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload?.success) {
        const access = payload.clientAccess;
        const passwordLine = access?.tempPassword
          ? ` Senha temporária: ${access.tempPassword}`
          : access?.reused
            ? ' Usuário existente vinculado ao cliente.'
            : '';
        setMessage({ type: 'success', text: `Cliente salvo com sucesso.${passwordLine}` });
        setShowForm(false);
        setForm(initialForm);
        setEnabledFeatures(getDefaultFeaturesForPlan(initialForm.plan, planOptions));
        await loadClients();
        return;
      }

      setMessage({ type: 'error', text: payload?.error || 'Não foi possível salvar o cliente.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Não foi possível salvar o cliente.' });
    } finally {
      setSaving(false);
    }
  };

  const handleClientStatus = async (client: PartnerClient, nextStatus: 'active' | 'blocked') => {
    let reason = '';
    if (nextStatus === 'blocked') {
      reason = window.prompt('Motivo do bloqueio deste cliente:', 'Bloqueado pelo parceiro.') || '';
      if (!reason.trim()) return;
    }

    const response = await authorizedFetch('/api/partner/clients', {
      method: 'PATCH',
      body: JSON.stringify({
        organizationId: client.id,
        status: nextStatus,
        reason
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (response.ok && payload?.success) {
      setMessage({ type: 'success', text: nextStatus === 'blocked' ? 'Cliente bloqueado.' : 'Cliente liberado.' });
      await loadClients();
    } else {
      setMessage({ type: 'error', text: payload?.error || 'Não foi possível atualizar o cliente.' });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const initials = String(partner?.name || 'P').slice(0, 2).toUpperCase();

  if (loading) {
    return <main className={styles.empty}>Carregando portal...</main>;
  }

  const navItems: Array<{ id: ActiveView; label: string; icon: LucideIcon }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clientes', icon: UsersRound },
    { id: 'repasse', label: 'Repasse mensal', icon: CreditCard }
  ];

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          {partner?.logo_url ? (
            <img src={partner.logo_url} alt={partner.name} className={styles.logo} />
          ) : (
            <div className={styles.logoFallback}>{initials}</div>
          )}
          <div>
            <div className={styles.brandName}>{partner?.name || 'Parceiro'}</div>
            <div className={styles.brandSub}>White label</div>
          </div>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`${styles.navButton} ${activeView === item.id ? styles.navActive : ''}`}
                type="button"
                onClick={() => setActiveView(item.id)}
              >
                <span className={styles.navIcon}><Icon size={18} /></span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className={styles.sidebarCard}>
          <span>Repasse previsto</span>
          <strong>{formatCurrency(monthlyRepasse)}</strong>
          <small>{activeClients.length} licença{activeClients.length === 1 ? '' : 's'} ativa{activeClients.length === 1 ? '' : 's'}</small>
        </div>

        <button className={`btn btnSecondary ${styles.logout}`} type="button" onClick={handleLogout}>
          <LogOut size={18} />
          Sair
        </button>
      </aside>

      <section className={styles.content}>
        {partnerBlocked ? (
          <div className={styles.error}>
            Parceiro bloqueado: {partner?.blocked_reason || 'White label bloqueado pela plataforma.'}
          </div>
        ) : null}

        {message ? (
          <div className={message.type === 'error' ? styles.error : styles.notice}>
            {message.text}
          </div>
        ) : null}

        {activeView === 'dashboard' ? (
          <div className={styles.page}>
            <header className={styles.hero}>
              <div>
                <p className={styles.eyebrow}>Portal white label</p>
                <h1 className={styles.title}>Dashboard do parceiro</h1>
                <p className={styles.subtitle}>Acompanhe sua carteira, ativações e valores de repasse do mês.</p>
              </div>
              <div className={styles.heroActions}>
                <button className="btn btnPrimary" type="button" onClick={openNewForm} disabled={partnerBlocked}>
                  <Plus size={18} />
                  Novo cliente
                </button>
                <button className="btn btnSecondary" type="button" onClick={() => setActiveView('repasse')}>
                  Ver repasse
                  <ArrowRight size={16} />
                </button>
              </div>
            </header>

            <section className={styles.summaryGrid}>
              <article className={styles.summaryCard}>
                <span>Total de clientes</span>
                <strong>{totals.total}</strong>
                <small>Clientes vinculados ao parceiro</small>
              </article>
              <article className={styles.summaryCard}>
                <span>Ativos</span>
                <strong>{totals.active}</strong>
                <small>Licenças que entram no repasse</small>
              </article>
              <article className={styles.summaryCard}>
                <span>Bloqueados</span>
                <strong>{totals.blocked}</strong>
                <small>Clientes parados na carteira</small>
              </article>
              <article className={styles.summaryCard}>
                <span>Repasse mensal</span>
                <strong>{formatCurrency(monthlyRepasse)}</strong>
                <small>{formatCurrency(licensePrice)} por licença ativa</small>
              </article>
            </section>

            <div className={styles.dashboardGrid}>
              <section className={`${styles.panel} ${styles.tablePanel}`}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Carteira</p>
                    <h2>Clientes recentes</h2>
                  </div>
                  <button className="btn btnSecondary" type="button" onClick={() => setActiveView('clients')}>
                    Ver clientes
                    <ArrowRight size={16} />
                  </button>
                </div>
                <div className={styles.panelBody}>
                  {recentClients.length === 0 ? (
                    <div className={styles.emptyState}>Nenhum cliente cadastrado ainda.</div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Empresa</th>
                          <th>Plano</th>
                          <th>Status</th>
                          <th>Sistema</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentClients.map((client) => {
                          const badge = getStatusBadge(client.status);
                          return (
                            <tr key={client.id}>
                              <td>
                                <strong>{client.nome_fantasia || client.name}</strong>
                                <small>{client.email || 'Email não informado'}</small>
                              </td>
                              <td>{client.plan_name || client.plan_code || 'Plano'}</td>
                              <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                              <td>{normalizeStatus(client.system) === 'food' ? 'DartFood' : 'DartWork'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Financeiro</p>
                    <h2>Resumo de repasse</h2>
                  </div>
                  <Wallet size={22} />
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.billingHighlight}>
                    <span>Valor previsto no mês</span>
                    <strong>{formatCurrency(monthlyRepasse)}</strong>
                    <small>{activeClients.length} x {formatCurrency(licensePrice)}</small>
                  </div>
                  <div className={styles.infoList}>
                    <div><span>Licenças ativas</span><strong>{activeClients.length}</strong></div>
                    <div><span>Valor por licença</span><strong>{formatCurrency(licensePrice)}</strong></div>
                    <div><span>Status do parceiro</span><strong>{partnerBlocked ? 'Bloqueado' : 'Ativo'}</strong></div>
                  </div>
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Operação</p>
                    <h2>Focos rápidos</h2>
                  </div>
                  <TrendingUp size={22} />
                </div>
                <div className={styles.panelBody}>
                  <button className={styles.focusCard} type="button" onClick={() => setActiveView('clients')}>
                    <span>Clientes bloqueados</span>
                    <strong>{totals.blocked}</strong>
                    <small>Revise clientes sem acesso</small>
                  </button>
                  <button className={styles.focusCard} type="button" onClick={openNewForm} disabled={partnerBlocked}>
                    <span>Nova ativação</span>
                    <strong>+</strong>
                    <small>Cadastrar novo cliente</small>
                  </button>
                </div>
              </section>
            </div>
          </div>
        ) : null}

        {activeView === 'clients' ? (
          <div className={styles.page}>
            <header className={styles.hero}>
              <div>
                <p className={styles.eyebrow}>Operação de clientes</p>
                <h1 className={styles.title}>Clientes</h1>
                <p className={styles.subtitle}>Cadastre clientes, defina plano, recursos e admin de acesso.</p>
              </div>
              <button className="btn btnPrimary" type="button" onClick={openNewForm} disabled={partnerBlocked}>
                <Plus size={18} />
                Novo cliente
              </button>
            </header>

            <section className={styles.summaryGrid}>
              <article className={styles.summaryCard}><span>Base total</span><strong>{totals.total}</strong><small>Clientes cadastrados</small></article>
              <article className={styles.summaryCard}><span>Ativos</span><strong>{totals.active}</strong><small>Operação normal</small></article>
              <article className={styles.summaryCard}><span>Bloqueados</span><strong>{totals.blocked}</strong><small>Acesso bloqueado</small></article>
              <article className={styles.summaryCard}><span>Vencidos</span><strong>{totals.overdue}</strong><small>Clientes em atenção</small></article>
            </section>

            <div className={styles.toolbar}>
              <div className={styles.searchField}>
                <Search size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por cliente, CNPJ, email..."
                />
              </div>
              <button className="btn btnSecondary" type="button" onClick={loadClients}>
                <RefreshCw size={18} />
                Atualizar
              </button>
            </div>

        {showForm ? (
          <form className={styles.form} onSubmit={handleSave}>
            <div className={styles.formHeader}>
              <div>
                <div className={styles.formTitle}>{form.id ? 'Editar cliente' : 'Novo cliente'}</div>
                <div className={styles.formHint}>Cadastro completo no mesmo padrão do admin principal.</div>
              </div>
              <button className="btn btnSecondary" type="button" onClick={() => setShowForm(false)}>
                <X size={18} />
                Fechar
              </button>
            </div>

            <div className={styles.steps}>
              <button type="button" className={`${styles.step} ${step >= 1 ? styles.active : ''}`} onClick={() => goToStep(1)}><span>1</span> Empresa</button>
              <div className={styles.stepLine} />
              <button type="button" className={`${styles.step} ${step >= 2 ? styles.active : ''}`} onClick={() => goToStep(2)}><span>2</span> Admin</button>
              <div className={styles.stepLine} />
              <button type="button" className={`${styles.step} ${step >= 3 ? styles.active : ''}`} onClick={() => goToStep(3)}><span>3</span> Recursos</button>
            </div>

            {step === 1 ? (
              <section className={styles.formSection}>
                <h2 className={styles.sectionTitle}><Building2 size={22} /> Dados Cadastrais</h2>
                <div className={styles.gridTwo}>
                  <label className={styles.field}>
                    <span className={styles.label}>CNPJ *</span>
                    <div className={styles.lookupRow}>
                      <input className={styles.input} value={form.cnpj} onChange={(event) => handleFieldChange('cnpj', event.target.value)} required maxLength={18} placeholder="00.000.000/0000-00" />
                      <button className={styles.iconButton} type="button" onClick={buscarCNPJ} disabled={searchingCnpj}>
                        {searchingCnpj ? <Loader2 size={18} className={styles.spin} /> : <Search size={18} />}
                      </button>
                    </div>
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Inscrição Estadual</span>
                    <input className={styles.input} value={form.inscricaoEstadual} onChange={(event) => handleFieldChange('inscricaoEstadual', event.target.value)} />
                  </label>
                  <label className={`${styles.field} ${styles.fullWidth}`}>
                    <span className={styles.label}>Razão Social *</span>
                    <input className={styles.input} value={form.razaoSocial} onChange={(event) => handleFieldChange('razaoSocial', event.target.value)} required />
                  </label>
                  <label className={`${styles.field} ${styles.fullWidth}`}>
                    <span className={styles.label}>Nome Fantasia *</span>
                    <input className={styles.input} value={form.nomeFantasia} onChange={(event) => handleFieldChange('nomeFantasia', event.target.value)} required />
                  </label>
                  <label className={`${styles.field} ${styles.fullWidth}`}>
                    <span className={styles.label}>CNAE Principal</span>
                    <input className={styles.input} value={form.cnaePrincipal} onChange={(event) => handleFieldChange('cnaePrincipal', event.target.value)} placeholder="Descrição ou código" />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Email *</span>
                    <input className={styles.input} type="email" value={form.email} onChange={(event) => handleFieldChange('email', event.target.value)} required />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Telefone</span>
                    <input className={styles.input} value={form.phone} onChange={(event) => handleFieldChange('phone', event.target.value)} />
                  </label>
                </div>

                <h2 className={styles.sectionTitle}><MapPin size={22} /> Endereço</h2>
                <div className={styles.gridTwo}>
                  <label className={styles.field}>
                    <span className={styles.label}>CEP</span>
                    <input className={styles.input} value={form.cep} onChange={(event) => handleFieldChange('cep', event.target.value)} onBlur={buscarCEP} maxLength={9} placeholder="00000-000" />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Logradouro</span>
                    <input className={styles.input} value={form.logradouro} onChange={(event) => handleFieldChange('logradouro', event.target.value)} />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Número</span>
                    <input className={styles.input} value={form.numero} onChange={(event) => handleFieldChange('numero', event.target.value)} />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Bairro</span>
                    <input className={styles.input} value={form.bairro} onChange={(event) => handleFieldChange('bairro', event.target.value)} />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Cidade</span>
                    <input className={styles.input} value={form.cidade} onChange={(event) => handleFieldChange('cidade', event.target.value)} />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>UF</span>
                    <input className={styles.input} value={form.uf} onChange={(event) => handleFieldChange('uf', event.target.value)} maxLength={2} />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Cód. IBGE</span>
                    <input className={styles.input} value={form.codIbge} onChange={(event) => handleFieldChange('codIbge', event.target.value)} />
                  </label>
                </div>
                <div className={styles.actions}>
                  <button className="btn btnSecondary" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
                  <button className="btn btnPrimary" type="button" onClick={() => goToStep(2)}>Próximo</button>
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section className={styles.formSection}>
                <h2 className={styles.sectionTitle}><User size={22} /> Administrador e Plano</h2>
                <div className={styles.gridTwo}>
                  <label className={`${styles.field} ${styles.fullWidth}`}>
                    <span className={styles.label}>Plano Escolhido *</span>
                    <select className={styles.select} value={form.plan} onChange={(event) => handleFieldChange('plan', event.target.value)} required>
                      {planOptions.map((plan) => (
                        <option key={plan.code} value={normalizePlanCode(plan.code)}>{plan.name}</option>
                      ))}
                    </select>
                    <span className={styles.help}>Plano selecionado: <strong>{selectedPlanName}</strong></span>
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Código interno</span>
                    <input className={styles.input} value={form.clientCode} onChange={(event) => handleFieldChange('clientCode', event.target.value)} />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Status</span>
                    <select className={styles.select} value={form.status} onChange={(event) => handleFieldChange('status', event.target.value)}>
                      <option value="active">Ativo</option>
                      <option value="blocked">Bloqueado</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </label>
                </div>

                <div className={styles.systemGrid}>
                  <button type="button" className={`${styles.systemCard} ${form.system === 'work' ? styles.systemActive : ''}`} onClick={() => { updateField('system', 'work'); updateField('segment', ''); }}>
                    <Briefcase size={28} />
                    <strong>DartWork</strong>
                    <span>ERP Comercial / Serviços</span>
                  </button>
                  <button type="button" className={`${styles.systemCard} ${form.system === 'food' ? styles.systemActive : ''}`} onClick={() => { updateField('system', 'food'); updateField('segment', 'padaria'); }}>
                    <Utensils size={28} />
                    <strong>DartFood</strong>
                    <span>PDV para Alimentação</span>
                  </button>
                </div>

                {form.system === 'work' ? (
                  <div>
                    <span className={styles.label}>Segmento do Negócio</span>
                    <div className={styles.segmentGrid}>
                      {segmentOptions.map((segment) => (
                        <button
                          key={segment.key}
                          type="button"
                          className={`${styles.segmentCard} ${form.segment === segment.key ? styles.segmentActive : ''}`}
                          onClick={() => updateField('segment', segment.key)}
                        >
                          <strong>{segment.label}</strong>
                          <span>{segment.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <label className={styles.tabletOption}>
                    <input type="checkbox" checked={form.enableTablet} onChange={(event) => updateField('enableTablet', event.target.checked)} />
                    <Tablet size={22} />
                    <span><strong>Liberar Cardápio Tablet</strong> Permite que o cliente use tablets nas mesas para pedidos.</span>
                  </label>
                )}

                <div className={styles.gridTwo}>
                  <label className={styles.field}>
                    <span className={styles.label}>Nome do Admin {form.id ? '' : '*'}</span>
                    <input className={styles.input} value={form.adminName} onChange={(event) => handleFieldChange('adminName', event.target.value)} required={!form.id} />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Email de Acesso {form.id ? '' : '*'}</span>
                    <input className={styles.input} type="email" value={form.adminEmail} onChange={(event) => handleFieldChange('adminEmail', event.target.value)} required={!form.id} />
                  </label>
                  <label className={`${styles.field} ${styles.fullWidth}`}>
                    <span className={styles.label}>Senha Inicial {form.id ? '' : '*'}</span>
                    <input className={styles.input} type="password" value={form.adminPassword} onChange={(event) => handleFieldChange('adminPassword', event.target.value)} minLength={6} required={!form.id} />
                  </label>
                </div>
                <div className={styles.actions}>
                  <button className="btn btnSecondary" type="button" onClick={() => goToStep(1)}>Voltar</button>
                  <button className="btn btnPrimary" type="button" onClick={() => goToStep(3)}>Próximo</button>
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <section className={styles.formSection}>
                <h2 className={styles.sectionTitle}><Settings2 size={22} /> Funcionalidades</h2>
                <FeaturePicker enabledFeatures={enabledFeatures} onChange={setEnabledFeatures} />
                <div className={styles.actions}>
                  <button className="btn btnSecondary" type="button" onClick={() => goToStep(2)}>Voltar</button>
                  <button className="btn btnPrimary" type="submit" disabled={saving || partnerBlocked}>
                    <Save size={18} />
                    {saving ? 'Salvando...' : form.id ? 'Salvar Cliente' : 'Criar Cliente'}
                  </button>
                </div>
              </section>
            ) : null}
          </form>
        ) : null}

            <section className={`${styles.panel} ${styles.tablePanel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Carteira operacional</p>
                  <h2>Clientes cadastrados</h2>
                </div>
                <span className={styles.resultMeta}>
                  {filteredClients.length} resultado{filteredClients.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className={styles.panelBody}>
                {filteredClients.length === 0 ? (
                  <div className={styles.emptyState}>Nenhum cliente cadastrado.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Empresa</th>
                        <th>CNPJ</th>
                        <th>Plano</th>
                        <th>Sistema</th>
                        <th>Status</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.map((client) => {
                        const badge = getStatusBadge(client.status);
                        const isBlocked = normalizeStatus(client.status) === 'bloqueado' || normalizeStatus(client.status) === 'blocked';

                        return (
                          <tr key={client.id}>
                            <td>
                              <strong>{client.nome_fantasia || client.name}</strong>
                              <small>{client.email || 'Email não informado'} · {client.phone || 'Telefone não informado'}</small>
                            </td>
                            <td>{client.cnpj ? formatCNPJ(client.cnpj) : '—'}</td>
                            <td>{client.plan_name || client.plan_code || 'Plano'}</td>
                            <td>{normalizeStatus(client.system) === 'food' ? 'DartFood' : 'DartWork'}</td>
                            <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                            <td>
                              <div className={styles.tableActions}>
                                <button className="btn btnSecondary" type="button" onClick={() => openEditForm(client)}>
                                  <Edit size={16} />
                                  Editar
                                </button>
                                {isBlocked ? (
                                  <button className="btn btnPrimary" type="button" onClick={() => handleClientStatus(client, 'active')}>
                                    <Unlock size={16} />
                                    Liberar
                                  </button>
                                ) : (
                                  <button className="btn btnDanger" type="button" onClick={() => handleClientStatus(client, 'blocked')}>
                                    <Lock size={16} />
                                    Bloquear
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {activeView === 'repasse' ? (
          <div className={styles.page}>
            <header className={styles.hero}>
              <div>
                <p className={styles.eyebrow}>Financeiro white label</p>
                <h1 className={styles.title}>Repasse mensal</h1>
                <p className={styles.subtitle}>Resumo dos valores calculados por licença ativa na carteira do parceiro.</p>
              </div>
              <button className="btn btnPrimary" type="button" onClick={openNewForm} disabled={partnerBlocked}>
                <Plus size={18} />
                Ativar cliente
              </button>
            </header>

            <section className={styles.summaryGrid}>
              <article className={styles.summaryCard}>
                <span>Licenças ativas</span>
                <strong>{activeClients.length}</strong>
                <small>Clientes cobrados no mês</small>
              </article>
              <article className={styles.summaryCard}>
                <span>Valor por licença</span>
                <strong>{formatCurrency(licensePrice)}</strong>
                <small>Definido no admin principal</small>
              </article>
              <article className={styles.summaryCard}>
                <span>Total previsto</span>
                <strong>{formatCurrency(monthlyRepasse)}</strong>
                <small>Ativos x valor da licença</small>
              </article>
              <article className={styles.summaryCard}>
                <span>Fora do repasse</span>
                <strong>{totals.blocked + totals.overdue}</strong>
                <small>Bloqueados ou vencidos</small>
              </article>
            </section>

            <div className={styles.repasseGrid}>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Resumo do mês</p>
                    <h2>Valor a repassar</h2>
                  </div>
                  <Calculator size={22} />
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.invoiceBox}>
                    <div>
                      <span>Parceiro</span>
                      <strong>{partner?.name || 'Parceiro'}</strong>
                    </div>
                    <div>
                      <span>Licenças ativas</span>
                      <strong>{activeClients.length}</strong>
                    </div>
                    <div>
                      <span>Preço unitário</span>
                      <strong>{formatCurrency(licensePrice)}</strong>
                    </div>
                    <div className={styles.invoiceTotal}>
                      <span>Total previsto</span>
                      <strong>{formatCurrency(monthlyRepasse)}</strong>
                    </div>
                  </div>
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.panelEyebrow}>Controle</p>
                    <h2>Status comercial</h2>
                  </div>
                  <AlertTriangle size={22} />
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.infoList}>
                    <div><span>Parceiro</span><strong>{partnerBlocked ? 'Bloqueado' : 'Liberado'}</strong></div>
                    <div><span>Clientes ativos</span><strong>{totals.active}</strong></div>
                    <div><span>Clientes bloqueados</span><strong>{totals.blocked}</strong></div>
                  </div>
                </div>
              </section>
            </div>

            <section className={`${styles.panel} ${styles.tablePanel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Licenças</p>
                  <h2>Base de cálculo</h2>
                </div>
              </div>
              <div className={styles.panelBody}>
                {clients.length === 0 ? (
                  <div className={styles.emptyState}>Nenhum cliente para calcular repasse.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Status</th>
                        <th>Licença</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((client) => {
                        const badge = getStatusBadge(client.status);
                        const isActive = ['ativo', 'active'].includes(normalizeStatus(client.status));
                        return (
                          <tr key={client.id}>
                            <td>
                              <strong>{client.nome_fantasia || client.name}</strong>
                              <small>{client.cnpj ? formatCNPJ(client.cnpj) : 'Documento não informado'}</small>
                            </td>
                            <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                            <td>{isActive ? 'Ativa' : 'Não cobrada'}</td>
                            <td>{formatCurrency(isActive ? licensePrice : 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
