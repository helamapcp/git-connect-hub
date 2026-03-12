import { useEffect, useMemo, useState } from 'react';
import { appendSystemLog } from '@/lib/systemLog';

const INVENTORY_STORAGE_KEY = 'frontend-inventory-by-location-v1';
const INVENTORY_EVENT = 'frontend-inventory-updated';

export const STOCK_LOCATIONS = ['CD', 'PCP', 'PMP', 'FÁBRICA', 'LOGÍSTICA'];

const DEFAULT_ITEMS = [
  { id: 'cd-1', location: 'CD', item_name: 'PVC Virgem', item_type: 'Matéria-prima', quantity: 12500, unit: 'kg', updated_at: new Date().toISOString() },
  { id: 'cd-2', location: 'CD', item_name: 'Pigmento Branco', item_type: 'Matéria-prima', quantity: 980, unit: 'kg', updated_at: new Date().toISOString() },
  { id: 'pcp-1', location: 'PCP', item_name: 'PVC Transferido', item_type: 'Matéria-prima', quantity: 6200, unit: 'kg', updated_at: new Date().toISOString() },
  { id: 'pcp-2', location: 'PCP', item_name: 'Estabilizante', item_type: 'Matéria-prima', quantity: 420, unit: 'kg', updated_at: new Date().toISOString() },
  { id: 'pmp-1', location: 'PMP', item_name: 'Composto Lote A23', item_type: 'Composto produzido', quantity: 3900, unit: 'kg', updated_at: new Date().toISOString() },
  { id: 'pmp-2', location: 'PMP', item_name: 'Sobra Formulação B11', item_type: 'Sobra de lote', quantity: 220, unit: 'kg', updated_at: new Date().toISOString() },
  { id: 'fab-1', location: 'FÁBRICA', item_name: 'Composto Liberado Linha 1', item_type: 'Composto para produção', quantity: 2400, unit: 'kg', updated_at: new Date().toISOString() },
  { id: 'fab-2', location: 'FÁBRICA', item_name: 'PA Telha Colonial', item_type: 'Produto acabado', quantity: 1800, unit: 'un', updated_at: new Date().toISOString() },
  { id: 'log-1', location: 'LOGÍSTICA', item_name: 'PA Forro PVC Branco', item_type: 'Pronto para faturar', quantity: 620, unit: 'caixa', updated_at: new Date().toISOString() },
  { id: 'log-2', location: 'LOGÍSTICA', item_name: 'PA Cumeeira Cinza', item_type: 'Pronto para faturar', quantity: 410, unit: 'un', updated_at: new Date().toISOString() },
];

const parseSafe = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const loadInventory = () => {
  if (typeof window === 'undefined') return DEFAULT_ITEMS;
  const raw = window.localStorage.getItem(INVENTORY_STORAGE_KEY);
  const parsed = parseSafe(raw, null);
  return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ITEMS;
};

const persistInventory = (items) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(INVENTORY_EVENT));
};

export const useInventoryStore = () => {
  const [items, setItems] = useState(() => loadInventory());

  useEffect(() => {
    persistInventory(items);
  }, [items]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refresh = () => setItems(loadInventory());
    window.addEventListener('storage', refresh);
    window.addEventListener(INVENTORY_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(INVENTORY_EVENT, refresh);
    };
  }, []);

  const getItemsByLocation = (location) => items.filter((item) => item.location === location);

  const summaryByLocation = useMemo(() => {
    const grouped = STOCK_LOCATIONS.reduce((acc, location) => {
      acc[location] = { totalItems: 0, totalQuantity: 0 };
      return acc;
    }, {});

    items.forEach((item) => {
      const target = grouped[item.location] || (grouped[item.location] = { totalItems: 0, totalQuantity: 0 });
      target.totalItems += 1;
      target.totalQuantity += Number(item.quantity || 0);
    });

    return grouped;
  }, [items]);

  const adjustItemQuantity = ({ location, itemId, adjustmentQty, comment, userName = 'Frontend Local' }) => {
    const normalizedComment = String(comment || '').trim();
    if (!normalizedComment) throw new Error('Comentário é obrigatório para ajuste manual.');

    const delta = Number(adjustmentQty);
    if (!Number.isFinite(delta) || delta === 0) throw new Error('Informe uma quantidade diferente de zero para ajuste.');

    let updatedItem = null;

    setItems((prev) => prev.map((item) => {
      if (item.id !== itemId || item.location !== location) return item;
      const nextQty = Number(item.quantity || 0) + delta;
      updatedItem = {
        ...item,
        quantity: nextQty < 0 ? 0 : Number(nextQty.toFixed(2)),
        updated_at: new Date().toISOString(),
      };
      return updatedItem;
    }));

    if (updatedItem) {
      appendSystemLog({
        action: 'Ajuste manual de estoque',
        action_type: 'adjustment',
        location,
        user_name: userName,
        parameters: {
          item: updatedItem.item_name,
          adjustment: delta,
          unit: updatedItem.unit,
          quantity_after: updatedItem.quantity,
          comment: normalizedComment,
        },
      });
    }
  };

  return {
    items,
    getItemsByLocation,
    summaryByLocation,
    adjustItemQuantity,
  };
};

export { INVENTORY_STORAGE_KEY };