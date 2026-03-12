import { useMemo } from 'react';

export const ROLE_IDS = {
  ADMIN: 'admin',
  GENERAL_MANAGEMENT: 'general_management',
  LOGISTICS_MANAGEMENT: 'logistics_management',
  STOCK_OPERATOR: 'stock_operator',
  MACHINE_OPERATOR: 'machine_operator',
};

export const ROLE_LABELS = {
  [ROLE_IDS.ADMIN]: 'Admin',
  [ROLE_IDS.GENERAL_MANAGEMENT]: 'General Management',
  [ROLE_IDS.LOGISTICS_MANAGEMENT]: 'Logistics Management',
  [ROLE_IDS.STOCK_OPERATOR]: 'Stock Operator',
  [ROLE_IDS.MACHINE_OPERATOR]: 'Machine Operator',
};

const ROLE_ALIASES = {
  gerente: ROLE_IDS.GENERAL_MANAGEMENT,
  supervisor: ROLE_IDS.GENERAL_MANAGEMENT,
  pcp: ROLE_IDS.STOCK_OPERATOR,
  operador: ROLE_IDS.MACHINE_OPERATOR,
};

const PAGE_ACCESS = {
  [ROLE_IDS.ADMIN]: ['*'],
  [ROLE_IDS.GENERAL_MANAGEMENT]: [
    'Dashboard',
    'MachineSelection',
    'Production',
    'Orders',
    'PATracking',
    'FactoryDashboard',
    'Estoque',
    'FormulationPlanning',
    'ConsumptionHistory',
    'PlanejamentoComposto',
  ],
  [ROLE_IDS.LOGISTICS_MANAGEMENT]: ['PATracking', 'Estoque', 'Dashboard'],
  [ROLE_IDS.STOCK_OPERATOR]: ['Estoque', 'Dashboard', 'BagInventory', 'BagTransfer', 'FormulationPlanning', 'PlanejamentoComposto'],
  [ROLE_IDS.MACHINE_OPERATOR]: ['MachineSelection', 'Production'],
};

const ACTION_ACCESS = {
  [ROLE_IDS.ADMIN]: ['*'],
  [ROLE_IDS.GENERAL_MANAGEMENT]: ['view.all'],
  [ROLE_IDS.LOGISTICS_MANAGEMENT]: ['view.logistics', 'logistics.manage'],
  [ROLE_IDS.STOCK_OPERATOR]: ['view.inventory', 'inventory.adjust', 'inventory.transfer'],
  [ROLE_IDS.MACHINE_OPERATOR]: ['view.machines'],
};

export const normalizeRole = (role) => {
  if (!role) return ROLE_IDS.MACHINE_OPERATOR;
  const cleaned = String(role).trim().toLowerCase();
  return ROLE_ALIASES[cleaned] || cleaned;
};

export const getRoleLabel = (role) => {
  const normalized = normalizeRole(role);
  return ROLE_LABELS[normalized] || normalized;
};

export const canAccessPage = (role, pageName) => {
  const normalized = normalizeRole(role);
  const allowedPages = PAGE_ACCESS[normalized] || [];
  return allowedPages.includes('*') || allowedPages.includes(pageName);
};

export const canPerformAction = (role, action, context = {}) => {
  const normalized = normalizeRole(role);
  const allowedActions = ACTION_ACCESS[normalized] || [];

  if (allowedActions.includes('*') || allowedActions.includes(action)) return true;

  if (normalized === ROLE_IDS.LOGISTICS_MANAGEMENT && action === 'inventory.adjust') {
    return String(context.location || '').toUpperCase() === 'LOGÍSTICA';
  }

  if (normalized === ROLE_IDS.LOGISTICS_MANAGEMENT && action === 'inventory.transfer') {
    return String(context.location || '').toUpperCase() === 'LOGÍSTICA';
  }

  return false;
};

export const useRolePermissions = (role) => {
  const normalizedRole = normalizeRole(role);

  return useMemo(
    () => ({
      role: normalizedRole,
      canAccessPage: (pageName) => canAccessPage(normalizedRole, pageName),
      canPerformAction: (action, context) => canPerformAction(normalizedRole, action, context),
    }),
    [normalizedRole]
  );
};
