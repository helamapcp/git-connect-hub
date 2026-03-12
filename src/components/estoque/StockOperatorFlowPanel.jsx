import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUsersStore } from '@/lib/userStore';
import { useInventoryStore } from '@/lib/inventoryStore';
import { computeScheduledSuggestions, useOperatorFlowStore } from '@/lib/operatorFlowStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Boxes, ClipboardList, PackagePlus, RefreshCw, Route, Workflow } from 'lucide-react';

const toDayKey = (dateLike) => {
  const date = new Date(dateLike);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
};

const formatNumber = (value) => Number(value || 0).toFixed(2);

const buildMaterialOptionValue = (material) => `${material.id}::${material.nome}`;

export default function StockOperatorFlowPanel() {
  const { currentUser } = useUsersStore();
  const { summaryByLocation, receiveMaterial, transferMaterial } = useInventoryStore();
  const {
    transferRequests,
    generatedOps,
    separationOrders,
    openSeparationOrders,
    bagTraceability,
    addReception,
    createTransferRequest,
    createSeparationOrder,
    updateSeparationLine,
    completeSeparationOrder,
  } = useOperatorFlowStore();

  const [selectedDayKey, setSelectedDayKey] = useState(toDayKey(new Date()));

  const [receptionDraft, setReceptionDraft] = useState({
    materialName: '',
    quantity: '',
    unit: 'kg',
    sackKg: '25',
    notes: '',
  });

  const [manualDraft, setManualDraft] = useState({
    sourceLocation: 'CD',
    destinationLocation: 'PCP',
    materialValue: '',
    quantity: '',
    unit: 'kg',
    sackKg: '25',
    mixer: 'Misturador 1',
    shift: '2',
    notes: '',
  });

  const { data: formulacoes = [] } = useQuery({
    queryKey: ['formulacoes'],
    queryFn: () => base44.entities.Formulacao.filter({ ativo: true }),
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ['raw-materials-active'],
    queryFn: () => base44.entities.RawMaterial.filter({ ativo: true }),
  });

  const scheduledSuggestions = useMemo(
    () => computeScheduledSuggestions({ formulacoes, materiais, targetDayKey: selectedDayKey }),
    [formulacoes, materiais, selectedDayKey]
  );

  const summaryCards = [
    {
      label: 'Transferências pendentes',
      value: transferRequests.filter((item) => item.status !== 'completed').length,
      icon: Route,
    },
    {
      label: 'Ordens de separação abertas',
      value: openSeparationOrders.length,
      icon: ClipboardList,
    },
    {
      label: 'OPs geradas por misturador',
      value: generatedOps.length,
      icon: Workflow,
    },
    {
      label: 'Bags rastreadas',
      value: bagTraceability.length,
      icon: Boxes,
    },
  ];

  const stockByLocation = [
    { key: 'CD', label: 'CD' },
    { key: 'PCP', label: 'PCP' },
    { key: 'PMP', label: 'PMP' },
  ];

  const handleReception = () => {
    const qty = Number(receptionDraft.quantity || 0);
    const sackKg = Number(receptionDraft.sackKg || 25);
    if (!receptionDraft.materialName.trim()) return toast.error('Select a material for reception.');
    if (!Number.isFinite(qty) || qty <= 0) return toast.error('Enter a valid quantity.');

    const quantityKg = receptionDraft.unit === 'sacks' ? qty * sackKg : qty;
    const quantitySacks = receptionDraft.unit === 'sacks' ? qty : qty / sackKg;

    receiveMaterial({
      location: 'CD',
      itemName: receptionDraft.materialName,
      quantityKg,
      itemType: 'Matéria-prima',
      comment: receptionDraft.notes,
      userName: currentUser?.full_name,
    });

    addReception({
      materialName: receptionDraft.materialName,
      quantityKg,
      quantitySacks,
      sackKg,
      notes: receptionDraft.notes,
      userName: currentUser?.full_name,
    });

    toast.success('Material received in CD and stock updated.');
    setReceptionDraft({ materialName: '', quantity: '', unit: 'kg', sackKg: '25', notes: '' });
  };

  const createScheduledTransfer = (suggestion) => {
    createTransferRequest({
      kind: 'scheduled',
      sourceLocation: suggestion.sourceLocation,
      destinationLocation: suggestion.destinationLocation,
      dayKey: suggestion.dayKey,
      mixer: suggestion.mixer,
      shift: suggestion.shift,
      batches: suggestion.batches,
      formulationName: suggestion.formulationName,
      materials: suggestion.materials,
      notes: `Programação PMP ${suggestion.dayKey}`,
      userName: currentUser?.full_name,
    });

    toast.success(`Transfer + OP generated for ${suggestion.formulationName}.`);
  };

  const createManualTransfer = () => {
    const qty = Number(manualDraft.quantity || 0);
    const sackKg = Number(manualDraft.sackKg || 25);
    if (!manualDraft.materialValue) return toast.error('Select a material.');
    if (!Number.isFinite(qty) || qty <= 0) return toast.error('Enter a valid transfer quantity.');

    const [, materialNameRaw] = manualDraft.materialValue.split('::');
    const materialName = materialNameRaw || 'Matéria-prima';
    const kg = manualDraft.unit === 'sacks' ? qty * sackKg : qty;
    const newSacks = manualDraft.unit === 'sacks' ? qty : Math.ceil(kg / sackKg);

    createTransferRequest({
      kind: 'manual',
      sourceLocation: manualDraft.sourceLocation,
      destinationLocation: manualDraft.destinationLocation,
      dayKey: selectedDayKey,
      mixer: manualDraft.mixer,
      shift: manualDraft.shift,
      formulationName: 'Transferência manual',
      materials: [
        {
          materialKey: manualDraft.materialValue.split('::')[0],
          materialName,
          sackKg,
          requiredKg: kg,
          fromLeftoverKg: 0,
          newSacks,
          newlyDrawnKg: newSacks * sackKg,
          expectedPmpLeftoverKg: Number((newSacks * sackKg - kg).toFixed(2)),
        },
      ],
      notes: manualDraft.notes,
      userName: currentUser?.full_name,
    });

    toast.success('Manual transfer request created.');
    setManualDraft((prev) => ({ ...prev, materialValue: '', quantity: '', notes: '' }));
  };

  const handleOpenSeparation = (requestId) => {
    createSeparationOrder(requestId, currentUser?.full_name);
    toast.success('Separation order generated.');
  };

  const confirmSeparation = (order) => {
    try {
      const request = transferRequests.find((item) => item.id === order.requestId);
      if (!request) throw new Error('Transfer request not found.');

      (order.lines || []).forEach((line) => {
        transferMaterial({
          fromLocation: request.sourceLocation,
          toLocation: request.destinationLocation,
          itemName: line.materialName,
          quantityKg: line.dispatchKg,
          comment: `Ordem de separação ${order.id}`,
          reference: request.opNumber,
          userName: currentUser?.full_name,
        });
      });

      completeSeparationOrder(order.id, currentUser?.full_name);
      toast.success('Separation completed and stock transfer posted.');
    } catch (error) {
      toast.error(error.message || 'Could not complete separation order.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-semibold">{card.value}</p>
                </div>
                <div className="w-10 h-10 rounded-md border border-border bg-muted flex items-center justify-center">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock snapshot by location</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {stockByLocation.map((location) => (
            <div key={location.key} className="rounded-lg border border-border p-3">
              <p className="text-sm text-muted-foreground">{location.label}</p>
              <p className="text-lg font-semibold">{formatNumber(summaryByLocation[location.key]?.totalQuantity)} kg</p>
              <p className="text-xs text-muted-foreground">{summaryByLocation[location.key]?.totalItems || 0} itens</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Material reception (CD arrival)</CardTitle>
            <CardDescription>Register incoming material in kg or sacks with automatic conversion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Material</Label>
              <Select
                value={receptionDraft.materialName}
                onValueChange={(value) => setReceptionDraft((prev) => ({ ...prev, materialName: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select material" />
                </SelectTrigger>
                <SelectContent>
                  {materiais.map((material) => (
                    <SelectItem key={material.id} value={material.nome || material.codigo}>
                      {material.codigo} • {material.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={receptionDraft.quantity}
                  onChange={(event) => setReceptionDraft((prev) => ({ ...prev, quantity: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={receptionDraft.unit} onValueChange={(value) => setReceptionDraft((prev) => ({ ...prev, unit: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="sacks">sacks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Sack weight (kg)</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={receptionDraft.sackKg}
                onChange={(event) => setReceptionDraft((prev) => ({ ...prev, sackKg: event.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={receptionDraft.notes}
                onChange={(event) => setReceptionDraft((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Supplier, invoice, or receiving notes"
              />
            </div>

            <Button className="w-full" onClick={handleReception}>
              <PackagePlus className="w-4 h-4 mr-2" /> Register reception
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manual transfer request</CardTitle>
            <CardDescription>Create CD → PCP or PCP → PMP requests with unit-to-kg conversion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From</Label>
                <Select value={manualDraft.sourceLocation} onValueChange={(value) => setManualDraft((prev) => ({ ...prev, sourceLocation: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CD">CD</SelectItem>
                    <SelectItem value="PCP">PCP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <Select value={manualDraft.destinationLocation} onValueChange={(value) => setManualDraft((prev) => ({ ...prev, destinationLocation: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PCP">PCP</SelectItem>
                    <SelectItem value="PMP">PMP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Material</Label>
              <Select value={manualDraft.materialValue} onValueChange={(value) => setManualDraft((prev) => ({ ...prev, materialValue: value }))}>
                <SelectTrigger><SelectValue placeholder="Select material" /></SelectTrigger>
                <SelectContent>
                  {materiais.map((material) => (
                    <SelectItem key={material.id} value={buildMaterialOptionValue(material)}>
                      {material.codigo} • {material.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualDraft.quantity}
                  onChange={(event) => setManualDraft((prev) => ({ ...prev, quantity: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={manualDraft.unit} onValueChange={(value) => setManualDraft((prev) => ({ ...prev, unit: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="sacks">sacks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Sack kg</Label>
                <Input type="number" value={manualDraft.sackKg} onChange={(event) => setManualDraft((prev) => ({ ...prev, sackKg: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Mixer</Label>
                <Input value={manualDraft.mixer} onChange={(event) => setManualDraft((prev) => ({ ...prev, mixer: event.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Shift</Label>
                <Input value={manualDraft.shift} onChange={(event) => setManualDraft((prev) => ({ ...prev, shift: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={manualDraft.notes}
                onChange={(event) => setManualDraft((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Manual request reason"
              />
            </div>

            <Button variant="outline" className="w-full" onClick={createManualTransfer}>
              Create manual request + OP
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">Scheduled PCP → PMP transfers</CardTitle>
              <CardDescription>Pulls automatically from Programação PMP day schedule.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" value={selectedDayKey} onChange={(event) => setSelectedDayKey(event.target.value)} className="w-[180px]" />
              <Button variant="outline" size="icon" onClick={() => setSelectedDayKey(toDayKey(new Date()))}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {scheduledSuggestions.length === 0 && (
            <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
              No scheduled PMP batches for this day.
            </div>
          )}

          {scheduledSuggestions.map((suggestion) => (
            <div key={suggestion.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{suggestion.formulationName}</p>
                  <p className="text-xs text-muted-foreground">
                    {suggestion.batches} batches • {suggestion.mixer} • Shift {suggestion.shift}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{suggestion.totalSacks} sacks</Badge>
                  <Badge variant="outline">{formatNumber(suggestion.totalKg)} kg</Badge>
                  <Button size="sm" onClick={() => createScheduledTransfer(suggestion)}>Generate request + OP</Button>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                {suggestion.materials.map((material) => (
                  <p key={`${suggestion.id}-${material.materialKey}`} className="text-muted-foreground">
                    {material.materialName}: consume {formatNumber(material.requiredKg)}kg • from PMP balance {formatNumber(material.fromLeftoverKg)}kg •
                    new sacks {material.newSacks} ({formatNumber(material.newlyDrawnKg)}kg) • expected PMP balance {formatNumber(material.expectedPmpLeftoverKg)}kg
                  </p>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transfer requests and generated OPs</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OP</TableHead>
                <TableHead>Flow</TableHead>
                <TableHead>Mixer / Shift</TableHead>
                <TableHead>Materials</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transferRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No transfer requests yet.</TableCell>
                </TableRow>
              ) : (
                transferRequests.map((request) => {
                  const existingOrder = separationOrders.find((order) => order.requestId === request.id);
                  return (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.opNumber}</TableCell>
                      <TableCell>{request.sourceLocation} → {request.destinationLocation}</TableCell>
                      <TableCell>{request.mixer} / {request.shift}</TableCell>
                      <TableCell>{request.materials.length} itens • {formatNumber(request.totalKg)} kg</TableCell>
                      <TableCell>
                        <Badge variant={request.status === 'completed' ? 'default' : 'secondary'}>{request.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {!existingOrder && request.status !== 'completed' && (
                          <Button size="sm" variant="outline" onClick={() => handleOpenSeparation(request.id)}>
                            Generate separation
                          </Button>
                        )}
                        {existingOrder && <Badge variant="outline">SO: {existingOrder.id.slice(0, 6)}</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Separation orders with justified adjustment</CardTitle>
          <CardDescription>Adjust dispatched sacks per line; changed quantities require justification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {openSeparationOrders.length === 0 && (
            <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
              No open separation orders.
            </div>
          )}

          {openSeparationOrders.map((order) => {
            const request = transferRequests.find((item) => item.id === order.requestId);
            return (
              <div key={order.id} className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-medium">SO {order.id.slice(0, 8)} • {request?.opNumber}</p>
                    <p className="text-xs text-muted-foreground">{request?.sourceLocation} → {request?.destinationLocation} • {request?.mixer}</p>
                  </div>
                  <Button size="sm" onClick={() => confirmSeparation(order)}>Confirm dispatch</Button>
                </div>

                <div className="space-y-2">
                  {(order.lines || []).map((line, index) => {
                    const changed = Number(line.dispatchSacks || 0) !== Number(line.requestedSacks || 0);
                    return (
                      <div key={`${order.id}-${line.materialKey}`} className="rounded-md border border-border p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{line.materialName}</p>
                          <Badge variant="outline">requested {line.requestedSacks} sacks ({formatNumber(line.requestedKg)}kg)</Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label>Dispatch sacks</Label>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={line.dispatchSacks}
                              onChange={(event) => updateSeparationLine(order.id, index, { dispatchSacks: event.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Dispatch kg</Label>
                            <Input value={formatNumber(line.dispatchKg)} readOnly />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Status</Label>
                            <Input value={changed ? 'Adjusted' : 'As requested'} readOnly />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label>Justification {changed ? '*' : '(optional)'}</Label>
                          <Textarea
                            value={line.justification || ''}
                            onChange={(event) => updateSeparationLine(order.id, index, { justification: event.target.value })}
                            placeholder="Required when dispatched sacks differ from requested"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
