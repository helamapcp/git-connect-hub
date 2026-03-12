import { useEffect, useMemo, useState } from 'react';
import { appendSystemLog } from '@/lib/systemLog';

const FLOW_STORAGE_KEY = 'frontend-operator-flow-v1';
const PMP_SCHEDULING_STORAGE_KEY = 'frontend-pmp-scheduling-v1';

const initialState = {
  receptions: [],
  transferRequests: [],
  separationOrders: [],
  generatedOps: [],
  bagTraceability: [],
};

const parseSafe = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const normalize = (value) => String(value || '').trim().toLowerCase();

const makeId = (prefix = 'flow') => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const toDayKey = (dateLike) => {
  const date = new Date(dateLike);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
};

const readState = () => {
  if (typeof window === 'undefined') return initialState;
  const parsed = parseSafe(window.localStorage.getItem(FLOW_STORAGE_KEY), initialState);
  return {
    ...initialState,
    ...(parsed && typeof parsed === 'object' ? parsed : {}),
  };
};

const persistState = (state) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(state));
};

const readPlanning = () => {
  if (typeof window === 'undefined') return {};
  const parsed = parseSafe(window.localStorage.getItem(PMP_SCHEDULING_STORAGE_KEY), {});
  return parsed && typeof parsed === 'object' ? parsed : {};
};

const parseIngredientes = (formulacao) => {
  const parsed = parseSafe(formulacao?.ingredientes, []);
  return Array.isArray(parsed) ? parsed : [];
};

const buildMaterialLookup = (materiais = []) => {
  const byId = new Map();
  const byName = new Map();

  materiais.forEach((material) => {
    const name = String(material?.nome || material?.codigo || '').trim();
    const sackKg = Number(material?.peso_saco_kg || 0) > 0 ? Number(material.peso_saco_kg) : 25;
    const meta = {
      id: material?.id || name,
      name: name || 'Matéria-prima',
      sackKg,
    };

    if (material?.id) byId.set(material.id, meta);
    if (name) byName.set(normalize(name), meta);
  });

  return { byId, byName };
};

const flattenPlanning = (planningByDay) =>
  Object.entries(planningByDay || {})
    .flatMap(([dayKey, lines]) =>
      (Array.isArray(lines) ? lines : []).map((line) => ({ ...line, dayKey }))
    )
    .sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });

export const computeScheduledSuggestions = ({ formulacoes = [], materiais = [], targetDayKey }) => {
  const planningByDay = readPlanning();
  const allLines = flattenPlanning(planningByDay);
  const lookup = buildMaterialLookup(materiais);
  const formulationMap = new Map(formulacoes.map((formula) => [formula.id, formula]));
  const leftoverByMaterial = new Map();

  const suggestions = [];

  allLines.forEach((line) => {
    const formulacao = formulationMap.get(line.formulationId);
    if (!formulacao) return;

    const ingredientes = parseIngredientes(formulacao);
    const batchCount = Number(line.batches || 0);
    if (!Number.isFinite(batchCount) || batchCount <= 0) return;

    const materials = [];

    ingredientes.forEach((ingrediente) => {
      const qtyPerBatch = Number(ingrediente.quantidade_kg || 0);
      if (!Number.isFinite(qtyPerBatch) || qtyPerBatch <= 0) return;

      const requiredKg = Number((qtyPerBatch * batchCount).toFixed(2));
      const ingredientName = String(ingrediente.material_nome || '').trim();
      const metaById = lookup.byId.get(ingrediente.material_id);
      const metaByName = lookup.byName.get(normalize(ingredientName));
      const meta = metaById || metaByName || { id: ingredientName || makeId('mat'), name: ingredientName || 'Matéria-prima', sackKg: 25 };

      const materialKey = String(meta.id || normalize(meta.name));
      const sackKg = Number(meta.sackKg || 25);
      const leftoverBefore = Number(leftoverByMaterial.get(materialKey) || 0);
      const fromLeftoverKg = Number(Math.min(leftoverBefore, requiredKg).toFixed(2));
      const missingKg = Number((requiredKg - fromLeftoverKg).toFixed(2));
      const newSacks = missingKg > 0 ? Math.ceil(missingKg / sackKg) : 0;
      const newlyDrawnKg = Number((newSacks * sackKg).toFixed(2));
      const leftoverAfter = Number((leftoverBefore + newlyDrawnKg - requiredKg).toFixed(2));

      leftoverByMaterial.set(materialKey, leftoverAfter);

      materials.push({
        materialKey,
        materialName: meta.name,
        sackKg,
        requiredKg,
        fromLeftoverKg,
        newSacks,
        newlyDrawnKg,
        expectedPmpLeftoverKg: leftoverAfter,
      });
    });

    if (line.dayKey !== targetDayKey) return;

    const totalKg = materials.reduce((sum, item) => sum + item.newlyDrawnKg, 0);
    const totalSacks = materials.reduce((sum, item) => sum + item.newSacks, 0);

    suggestions.push({
      id: line.id,
      dayKey: line.dayKey,
      formulationId: line.formulationId,
      formulationName: formulacao.nome || formulacao.material_final || 'Formulação',
      mixer: line.mixer || 'Misturador',
      shift: line.shift || '2',
      sourceLocation: line.sourceLocation || 'PCP',
      destinationLocation: 'PMP',
      batches: batchCount,
      materials,
      totalKg: Number(totalKg.toFixed(2)),
      totalSacks,
    });
  });

  return suggestions;
};

export const useOperatorFlowStore = () => {
  const [state, setState] = useState(() => readState());

  useEffect(() => {
    persistState(state);
  }, [state]);

  const nextOpNumber = () => {
    const next = (state.generatedOps?.length || 0) + 1;
    return `OP-PMP-${String(next).padStart(5, '0')}`;
  };

  const addReception = ({ materialName, quantityKg, quantitySacks, sackKg, notes, userName = 'Frontend Local' }) => {
    const reception = {
      id: makeId('rcv'),
      materialName,
      quantityKg: Number(quantityKg || 0),
      quantitySacks: Number(quantitySacks || 0),
      sackKg: Number(sackKg || 0),
      notes: String(notes || '').trim(),
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({ ...prev, receptions: [reception, ...(prev.receptions || [])] }));

    appendSystemLog({
      action: 'Recebimento CD',
      action_type: 'create',
      location: 'CD',
      user_name: userName,
      parameters: reception,
    });

    return reception;
  };

  const createTransferRequest = ({
    kind = 'manual',
    sourceLocation,
    destinationLocation,
    dayKey,
    mixer,
    shift,
    batches,
    formulationName,
    materials,
    notes,
    userName = 'Frontend Local',
  }) => {
    const normalizedMaterials = (materials || []).map((item) => ({
      materialKey: item.materialKey || normalize(item.materialName),
      materialName: item.materialName,
      sackKg: Number(item.sackKg || 25),
      requiredKg: Number(item.requiredKg || 0),
      fromLeftoverKg: Number(item.fromLeftoverKg || 0),
      newSacks: Number(item.newSacks || 0),
      newlyDrawnKg: Number(item.newlyDrawnKg || 0),
      expectedPmpLeftoverKg: Number(item.expectedPmpLeftoverKg || 0),
    }));

    const totalKg = normalizedMaterials.reduce((sum, item) => sum + Number(item.newlyDrawnKg || item.requiredKg || 0), 0);
    const totalSacks = normalizedMaterials.reduce((sum, item) => sum + Number(item.newSacks || 0), 0);

    const opNumber = nextOpNumber();

    const transferRequest = {
      id: makeId('trf'),
      kind,
      sourceLocation,
      destinationLocation,
      dayKey: dayKey || toDayKey(new Date()),
      mixer: mixer || 'Misturador 1',
      shift: String(shift || '2'),
      batches: Number(batches || 1),
      formulationName: formulationName || 'Transferência manual',
      materials: normalizedMaterials,
      totalKg: Number(totalKg.toFixed(2)),
      totalSacks,
      status: 'pending',
      notes: String(notes || '').trim(),
      opNumber,
      createdAt: new Date().toISOString(),
    };

    const op = {
      id: makeId('op'),
      opNumber,
      requestId: transferRequest.id,
      mixer: transferRequest.mixer,
      shift: transferRequest.shift,
      dayKey: transferRequest.dayKey,
      formulationName: transferRequest.formulationName,
      totalKg: transferRequest.totalKg,
      status: 'generated',
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      transferRequests: [transferRequest, ...(prev.transferRequests || [])],
      generatedOps: [op, ...(prev.generatedOps || [])],
    }));

    appendSystemLog({
      action: 'Solicitação de transferência',
      action_type: 'create',
      location: destinationLocation,
      user_name: userName,
      parameters: {
        request_id: transferRequest.id,
        op_number: opNumber,
        source: sourceLocation,
        destination: destinationLocation,
        total_kg: transferRequest.totalKg,
        total_sacks: transferRequest.totalSacks,
        mixer: transferRequest.mixer,
        shift: transferRequest.shift,
      },
    });

    return transferRequest;
  };

  const createSeparationOrder = (requestId, userName = 'Frontend Local') => {
    const request = (state.transferRequests || []).find((item) => item.id === requestId);
    if (!request) throw new Error('Transfer request not found.');

    const order = {
      id: makeId('sep'),
      requestId,
      status: 'open',
      lines: (request.materials || []).map((material) => ({
        materialKey: material.materialKey,
        materialName: material.materialName,
        sackKg: Number(material.sackKg || 25),
        requestedSacks: Number(material.newSacks || 0),
        requestedKg: Number(material.newlyDrawnKg || material.requiredKg || 0),
        dispatchSacks: Number(material.newSacks || 0),
        dispatchKg: Number(material.newlyDrawnKg || material.requiredKg || 0),
        justification: '',
      })),
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      separationOrders: [order, ...(prev.separationOrders || [])],
      transferRequests: (prev.transferRequests || []).map((item) =>
        item.id === requestId ? { ...item, status: 'separation_open' } : item
      ),
    }));

    appendSystemLog({
      action: 'Ordem de separação gerada',
      action_type: 'create',
      location: request.sourceLocation,
      user_name: userName,
      parameters: {
        request_id: requestId,
        order_id: order.id,
      },
    });

    return order;
  };

  const updateSeparationLine = (orderId, lineIndex, patch) => {
    setState((prev) => ({
      ...prev,
      separationOrders: (prev.separationOrders || []).map((order) => {
        if (order.id !== orderId) return order;
        const nextLines = [...(order.lines || [])];
        const current = nextLines[lineIndex];
        if (!current) return order;

        const nextSacks = patch.dispatchSacks != null ? Number(patch.dispatchSacks || 0) : current.dispatchSacks;
        const dispatchKg = Number((nextSacks * Number(current.sackKg || 25)).toFixed(2));

        nextLines[lineIndex] = {
          ...current,
          ...patch,
          dispatchSacks: nextSacks,
          dispatchKg,
          justification: patch.justification ?? current.justification,
        };

        return { ...order, lines: nextLines };
      }),
    }));
  };

  const completeSeparationOrder = (orderId, userName = 'Frontend Local') => {
    const order = (state.separationOrders || []).find((item) => item.id === orderId);
    if (!order) throw new Error('Separation order not found.');

    const request = (state.transferRequests || []).find((item) => item.id === order.requestId);
    if (!request) throw new Error('Related transfer request not found.');

    (order.lines || []).forEach((line) => {
      const changed = Number(line.dispatchSacks || 0) !== Number(line.requestedSacks || 0);
      if (changed && !String(line.justification || '').trim()) {
        throw new Error(`Justification required for ${line.materialName}.`);
      }
    });

    setState((prev) => ({
      ...prev,
      separationOrders: (prev.separationOrders || []).map((item) =>
        item.id === orderId ? { ...item, status: 'completed', completedAt: new Date().toISOString() } : item
      ),
      transferRequests: (prev.transferRequests || []).map((item) =>
        item.id === order.requestId ? { ...item, status: 'completed', completedAt: new Date().toISOString() } : item
      ),
    }));

    appendSystemLog({
      action: 'Separação concluída',
      action_type: 'update',
      location: request.destinationLocation,
      user_name: userName,
      parameters: {
        order_id: orderId,
        request_id: request.id,
      },
    });

    return { order, request };
  };

  const addBagTraceability = (payload) => {
    const record = {
      id: makeId('bag'),
      ...payload,
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      bagTraceability: [record, ...(prev.bagTraceability || [])],
    }));

    appendSystemLog({
      action: 'Rastreabilidade de sacola registrada',
      action_type: 'create',
      location: 'FÁBRICA',
      parameters: {
        bag_code: record.bagCode,
        op_number: record.opNumber,
        machine_code: record.machineCode,
        produced_kg: record.producedKg,
      },
    });

    return record;
  };

  const openSeparationOrders = useMemo(
    () => (state.separationOrders || []).filter((order) => order.status === 'open'),
    [state.separationOrders]
  );

  return {
    ...state,
    openSeparationOrders,
    addReception,
    createTransferRequest,
    createSeparationOrder,
    updateSeparationLine,
    completeSeparationOrder,
    addBagTraceability,
  };
};

export { FLOW_STORAGE_KEY, PMP_SCHEDULING_STORAGE_KEY };