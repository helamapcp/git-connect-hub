import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useInventoryStore, STOCK_LOCATIONS } from '@/lib/inventoryStore';
import { appendSystemLog } from '@/lib/systemLog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FlaskConical, CalendarDays, AlertTriangle, Send, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = 'frontend-formulation-daily-plan-v1';
const LEGACY_HANDOFF_KEY = 'frontend-formulation-plan-handoff-v1';
const HORIZON_DAYS = 7;

const makeId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toDayKey = (date) => startOfDay(date).toISOString().slice(0, 10);

const buildNextDays = () => {
  const base = startOfDay(new Date());
  return Array.from({ length: HORIZON_DAYS }).map((_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    return {
      key: toDayKey(date),
      label: date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      iso: date.toISOString(),
    };
  });
};

const parseSafe = (raw, fallback) => {
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const readPlanning = () => {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = parseSafe(raw, {});
  return parsed && typeof parsed === 'object' ? parsed : {};
};

const parseIngredientes = (formulacao) => {
  if (!formulacao?.ingredientes) return [];
  const parsed = parseSafe(formulacao.ingredientes, []);
  return Array.isArray(parsed) ? parsed : [];
};

const normalize = (value) => String(value || '').trim().toLowerCase();

export default function FormulationPlanning() {
  const days = useMemo(() => buildNextDays(), []);
  const [planningByDay, setPlanningByDay] = useState(() => readPlanning());
  const [draftByDay, setDraftByDay] = useState({});
  const { items: inventoryItems } = useInventoryStore();

  const { data: formulacoes = [] } = useQuery({
    queryKey: ['formulacoes'],
    queryFn: () => base44.entities.Formulacao.filter({ ativo: true }),
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(planningByDay));
  }, [planningByDay]);

  const formulationMap = useMemo(() => {
    const next = new Map();
    formulacoes.forEach((formulacao) => next.set(formulacao.id, formulacao));
    return next;
  }, [formulacoes]);

  const allPlannedLines = useMemo(
    () => Object.values(planningByDay).flatMap((list) => (Array.isArray(list) ? list : [])),
    [planningByDay]
  );

  const usageRows = useMemo(() => {
    const grouped = new Map();

    allPlannedLines.forEach((line) => {
      const formulacao = formulationMap.get(line.formulationId);
      if (!formulacao) return;
      const ingredientes = parseIngredientes(formulacao);
      ingredientes.forEach((ing) => {
        const materialNome = String(ing.material_nome || '').trim();
        const perBatch = Number(ing.quantidade_kg || 0);
        if (!materialNome || !Number.isFinite(perBatch) || perBatch <= 0) return;

        const requiredKg = perBatch * Number(line.batches || 0);
        if (requiredKg <= 0) return;

        const key = `${line.sourceLocation}::${normalize(materialNome)}`;
        const current = grouped.get(key) || {
          key,
          location: line.sourceLocation,
          material: materialNome,
          requiredKg: 0,
          availableKg: 0,
          days: new Set(),
          formulations: new Set(),
        };

        current.requiredKg += requiredKg;
        current.days.add(line.dayKey);
        current.formulations.add(formulacao.nome || formulacao.material_final || 'Formulação');
        grouped.set(key, current);
      });
    });

    grouped.forEach((entry) => {
      const stockAtLocation = inventoryItems.filter((item) => item.location === entry.location);
      const targetName = normalize(entry.material);
      entry.availableKg = stockAtLocation.reduce((sum, item) => {
        const itemName = normalize(item.item_name);
        const matches = itemName.includes(targetName) || targetName.includes(itemName);
        return matches ? sum + Number(item.quantity || 0) : sum;
      }, 0);
      entry.remainingKg = Number((entry.availableKg - entry.requiredKg).toFixed(2));
      entry.isCritical = entry.remainingKg < 0;
      entry.isWarning = !entry.isCritical && entry.availableKg > 0 && entry.remainingKg <= entry.availableKg * 0.2;
      entry.daysCount = entry.days.size;
      entry.formulationsCount = entry.formulations.size;
    });

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
      if (a.isWarning !== b.isWarning) return a.isWarning ? -1 : 1;
      return b.requiredKg - a.requiredKg;
    });
  }, [allPlannedLines, formulationMap, inventoryItems]);

  const summary = useMemo(() => {
    const totalBatches = allPlannedLines.reduce((sum, line) => sum + Number(line.batches || 0), 0);
    const totalCompoundKg = allPlannedLines.reduce((sum, line) => {
      const formulacao = formulationMap.get(line.formulationId);
      return sum + Number(formulacao?.peso_batelada_kg || 0) * Number(line.batches || 0);
    }, 0);
    const warningCount = usageRows.filter((row) => row.isCritical || row.isWarning).length;
    return {
      totalLines: allPlannedLines.length,
      totalBatches,
      totalCompoundKg,
      warningCount,
    };
  }, [allPlannedLines, formulationMap, usageRows]);

  const updateDraft = (dayKey, patch) => {
    setDraftByDay((prev) => ({
      ...prev,
      [dayKey]: {
        formulationId: prev?.[dayKey]?.formulationId || '',
        batches: prev?.[dayKey]?.batches || '1',
        sourceLocation: prev?.[dayKey]?.sourceLocation || 'PCP',
        ...patch,
      },
    }));
  };

  const addPlanLine = (dayKey) => {
    const draft = draftByDay?.[dayKey] || { formulationId: '', batches: '1', sourceLocation: 'PCP' };
    if (!draft.formulationId) {
      toast.error('Selecione uma formulação para planejar.');
      return;
    }

    const batches = Number(draft.batches);
    if (!Number.isFinite(batches) || batches <= 0) {
      toast.error('Informe um número de bateladas maior que zero.');
      return;
    }

    const sourceLocation = draft.sourceLocation || 'PCP';
    const formulacao = formulationMap.get(draft.formulationId);
    const nextLine = {
      id: makeId(),
      dayKey,
      formulationId: draft.formulationId,
      batches,
      sourceLocation,
      createdAt: new Date().toISOString(),
    };

    setPlanningByDay((prev) => ({
      ...prev,
      [dayKey]: [...(prev?.[dayKey] || []), nextLine],
    }));

    appendSystemLog({
      action: 'Planejamento diário de formulação',
      action_type: 'create',
      location: sourceLocation,
      parameters: {
        date: dayKey,
        formulation: formulacao?.nome || formulacao?.material_final || draft.formulationId,
        batches,
      },
    });

    toast.success('Formulação adicionada ao planejamento diário.');
  };

  const updateLine = (dayKey, lineId, patch) => {
    setPlanningByDay((prev) => ({
      ...prev,
      [dayKey]: (prev?.[dayKey] || []).map((line) =>
        line.id === lineId ? { ...line, ...patch, updatedAt: new Date().toISOString() } : line
      ),
    }));
  };

  const removeLine = (dayKey, lineId) => {
    setPlanningByDay((prev) => ({
      ...prev,
      [dayKey]: (prev?.[dayKey] || []).filter((line) => line.id !== lineId),
    }));

    appendSystemLog({
      action: 'Remoção de formulação planejada',
      action_type: 'delete',
      location: 'PMP',
      parameters: { date: dayKey, plan_line_id: lineId },
    });
  };

  const sendDayToLegacy = (dayKey) => {
    const lines = planningByDay?.[dayKey] || [];
    const payload = {
      exportedAt: new Date().toISOString(),
      dayKey,
      lines: lines.map((line) => {
        const formulacao = formulationMap.get(line.formulationId);
        return {
          id: line.id,
          formulationId: line.formulationId,
          formulationName: formulacao?.nome || formulacao?.material_final || 'Formulação',
          batches: line.batches,
          sourceLocation: line.sourceLocation,
          estimatedCompoundKg: Number(formulacao?.peso_batelada_kg || 0) * Number(line.batches || 0),
        };
      }),
    };

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LEGACY_HANDOFF_KEY, JSON.stringify(payload));
    }

    appendSystemLog({
      action: 'Envio para Composto Planning legado',
      action_type: 'transfer',
      location: 'PMP',
      parameters: { date: dayKey, planned_lines: payload.lines.length },
    });

    toast.success('Planejamento diário enviado para o Composto Planning legado.');
    window.location.href = createPageUrl('PlanejamentoComposto');
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <FlaskConical className="w-6 h-6 text-primary" />
            Formulation Planning
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Planejamento diário por formulação para produção PMP com controle de bateladas e consumo de MP.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={createPageUrl('PlanejamentoComposto')}>
            <Button variant="outline">Abrir Composto Planning legado</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Formulações planejadas</CardDescription>
            <CardTitle className="text-2xl">{summary.totalLines}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de bateladas</CardDescription>
            <CardTitle className="text-2xl">{summary.totalBatches}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Composto estimado (kg)</CardDescription>
            <CardTitle className="text-2xl">{summary.totalCompoundKg.toFixed(0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Alertas de MP</CardDescription>
            <CardTitle className="text-2xl">{summary.warningCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            Planejamento diário visual (Kanban)
          </CardTitle>
          <CardDescription>
            Defina formulações e bateladas por dia; o consumo de matéria-prima é recalculado automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {days.map((day) => {
              const dayLines = planningByDay?.[day.key] || [];
              const draft = draftByDay?.[day.key] || { formulationId: '', batches: '1', sourceLocation: 'PCP' };

              return (
                <Card key={day.key} className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{day.label}</CardTitle>
                    <CardDescription>{day.key}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>Formulação</Label>
                      <Select
                        value={draft.formulationId}
                        onValueChange={(value) => updateDraft(day.key, { formulationId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {formulacoes.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>Bateladas</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={draft.batches}
                          onChange={(e) => updateDraft(day.key, { batches: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Origem MP</Label>
                        <Select
                          value={draft.sourceLocation}
                          onValueChange={(value) => updateDraft(day.key, { sourceLocation: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STOCK_LOCATIONS.map((location) => (
                              <SelectItem key={location} value={location}>
                                {location}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button className="w-full" onClick={() => addPlanLine(day.key)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar ao dia
                    </Button>

                    <Separator />

                    <div className="space-y-2">
                      {dayLines.length === 0 && (
                        <p className="text-sm text-muted-foreground">Sem formulações planejadas.</p>
                      )}
                      {dayLines.map((line) => {
                        const formulacao = formulationMap.get(line.formulationId);
                        const estimatedKg = Number(formulacao?.peso_batelada_kg || 0) * Number(line.batches || 0);

                        return (
                          <div key={line.id} className="rounded-lg border border-border p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm">{formulacao?.nome || 'Formulação removida'}</p>
                                <p className="text-xs text-muted-foreground">{estimatedKg.toFixed(0)} kg estimados</p>
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => removeLine(day.key, line.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                value={line.batches}
                                onChange={(e) => {
                                  const value = Math.max(1, Number(e.target.value || 1));
                                  updateLine(day.key, line.id, { batches: value });
                                }}
                              />
                              <Select
                                value={line.sourceLocation}
                                onValueChange={(value) => updateLine(day.key, line.id, { sourceLocation: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STOCK_LOCATIONS.map((location) => (
                                    <SelectItem key={location} value={location}>
                                      {location}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Button variant="secondary" className="w-full" onClick={() => sendDayToLegacy(day.key)}>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar dia ao legado
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-primary" />
            Uso automático de matéria-prima
          </CardTitle>
          <CardDescription>
            Consumo acumulado por localização de estoque com aviso de baixo saldo para CD, PCP, PMP, FÁBRICA e LOGÍSTICA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {usageRows.length === 0 && (
            <p className="text-sm text-muted-foreground">Adicione formulações no quadro para visualizar consumo e alertas.</p>
          )}

          {usageRows.map((row) => (
            <div key={row.key} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div>
                  <p className="font-medium text-sm">{row.material}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.location} • {row.daysCount} dia(s) • {row.formulationsCount} formulação(ões)
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">Necessário: {row.requiredKg.toFixed(2)} kg</Badge>
                  <Badge variant="outline">Disponível: {row.availableKg.toFixed(2)} kg</Badge>
                  <Badge variant={row.isCritical ? 'destructive' : 'secondary'}>
                    Saldo: {row.remainingKg.toFixed(2)} kg
                  </Badge>
                </div>
              </div>
              {(row.isCritical || row.isWarning) && (
                <p className="text-xs mt-2 text-muted-foreground">
                  {row.isCritical
                    ? 'Alerta crítico: saldo insuficiente para cobrir o planejamento atual.'
                    : 'Atenção: saldo próximo do limite mínimo (20%).'}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
