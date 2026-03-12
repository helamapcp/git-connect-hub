import { appendSystemLog } from '@/lib/systemLog';

const mockUser = {
  id: 'local-user-1',
  full_name: 'Frontend Local',
  email: 'frontend@local.dev',
  role: 'admin',
  active: true,
};

const entityStore = new Map();

const ensureCollection = (entityName) => {
  if (!entityStore.has(entityName)) entityStore.set(entityName, []);
  return entityStore.get(entityName);
};

const makeId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const sortRows = (rows, orderBy) => {
  if (!orderBy || typeof orderBy !== 'string') return rows;
  const desc = orderBy.startsWith('-');
  const field = desc ? orderBy.slice(1) : orderBy;
  return [...rows].sort((a, b) => {
    const av = a?.[field];
    const bv = b?.[field];
    if (av === bv) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av > bv ? 1 : -1) * (desc ? -1 : 1);
  });
};

const logEntityAction = (actionType, entityName, parameters = {}) => {
  appendSystemLog({
    action: `${actionType.toUpperCase()} ${entityName}`,
    action_type: actionType,
    location: 'SISTEMA',
    user_id: mockUser.id,
    user_name: mockUser.full_name,
    parameters,
  });
};

const createEntityAPI = (entityName) => {
  const collection = () => ensureCollection(entityName);

  return {
    list: async (orderBy, limit) => {
      const rows = sortRows(collection(), orderBy);
      return typeof limit === 'number' ? rows.slice(0, limit) : rows;
    },
    filter: async (filters = {}) => {
      const rows = collection();
      const entries = Object.entries(filters || {});
      if (!entries.length) return [...rows];
      return rows.filter((row) => entries.every(([key, value]) => row?.[key] === value));
    },
    create: async (payload = {}) => {
      const row = {
        id: payload.id || makeId(),
        created_date: new Date().toISOString(),
        ...payload,
      };
      collection().unshift(row);
      logEntityAction('create', entityName, { id: row.id, payload: { ...payload } });
      return row;
    },
    update: async (id, payload = {}) => {
      const rows = collection();
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) {
        const created = { id: id || makeId(), ...payload };
        rows.unshift(created);
        logEntityAction('create', entityName, { id: created.id, payload: { ...payload }, via: 'update-fallback' });
        return created;
      }
      rows[idx] = { ...rows[idx], ...payload };
      logEntityAction('update', entityName, { id, payload: { ...payload } });
      return rows[idx];
    },
    delete: async (id) => {
      const rows = collection();
      const idx = rows.findIndex((r) => r.id === id);
      if (idx >= 0) rows.splice(idx, 1);
      logEntityAction('delete', entityName, { id });
      return { success: true };
    },
    get: async (id) => {
      return collection().find((r) => r.id === id) || null;
    },
  };
};

const entitiesProxy = new Proxy(
  {},
  {
    get: (_, entityName) => {
      if (!entityName) return createEntityAPI('Unknown');
      return createEntityAPI(String(entityName));
    },
  }
);

export const base44 = {
  auth: {
    me: async () => ({ ...mockUser }),
    isAuthenticated: async () => true,
    redirectToLogin: (nextUrl) => {
      if (typeof window !== 'undefined' && nextUrl) {
        window.location.href = nextUrl;
      }
    },
    logout: (redirectUrl) => {
      appendSystemLog({
        action: 'Logout',
        action_type: 'auth',
        user_id: mockUser.id,
        user_name: mockUser.full_name,
        location: 'SISTEMA',
      });
      if (typeof window !== 'undefined' && redirectUrl) {
        window.location.href = redirectUrl;
      }
    },
    loginWithProvider: async () => {
      appendSystemLog({
        action: 'Login with provider',
        action_type: 'auth',
        user_id: mockUser.id,
        user_name: mockUser.full_name,
        location: 'SISTEMA',
      });
      return { success: true };
    },
  },
  entities: entitiesProxy,
};
