import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRightLeft, CheckCircle2, ClipboardList, Package, Truck } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = 'pa-tracking-items-v1';
const DEFAULT_FORRO_M2_FACTOR = 2.5;

const STATUS_CONFIG = {
  factory: { label: 'Factory', badge: 'secondary' },
  in_logistics: { label: 'In logistics', badge: 'default' },
  delivered: { label: 'Delivered', badge: 'outline' },
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('pt-BR') : '—');

const getForroFactor = (item) => {
  const candidate = Number(item?.m2_per_box ?? item?.area_m2_per_box ?? item?.m2_factor);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : DEFAULT_FORRO_M2_FACTOR;
};

const mapOrdersToPAItems = (orders = []) => {
  const productionReadyOrders = orders.filter((order) => {
    const hasProduced = Number(order.quantity_produced || 0) > 0;
    const statusDone = ['FINALIZADA', 'completed'].includes(order.status);
    return order.active !== false && (hasProduced || statusDone);
  });

  return productionReadyOrders.map((order) => ({
    id: `pa-${order.id}`,
    order_id: order.id,
    op_number: order.order_number || `OP-${order.id?.slice(0, 6)}`,
    product_name: order.product_name || 'Produto sem nome',
    product_type: order.categoria_processo || 'OUTRO',
    available_qty: Number(order.quantity_produced || order.quantity_planned || 0),
    unit: order.unidade_producao || order.unit || 'UNIDADE',
    m2_factor: order.categoria_processo === 'FORRO' ? getForroFactor(order) : null,
    transfer_qty: Number(order.transfer_qty || 0),
    transfer_m2: Number(order.transfer_m2 || 0),
    transfer_timestamp: order.transfer_timestamp || null,
    delivered_timestamp: order.delivered_timestamp || null,
    status: order.pa_status || 'factory',
  }));
};

const samplePAItems = [
  {
    id: 'sample-pa-1',
    op_number: 'OP-000101',
    product_name: 'Forro PVC Branco',
    product_type: 'FORRO',
    available_qty: 180,
    unit: 'CAIXA',
    m2_factor: 2.5,
    transfer_qty: 0,
    transfer_m2: 0,
    transfer_timestamp: null,
    delivered_timestamp: null,
    status: 'factory',
  },
  {
    id: 'sample-pa-2',
    op_number: 'OP-000102',
    product_name: 'Telha Colonial',
    product_type: 'TELHA',
    available_qty: 420,
    unit: 'UNIDADE',
    m2_factor: null,
    transfer_qty: 0,
    transfer_m2: 0,
    transfer_timestamp: null,
    delivered_timestamp: null,
    status: 'factory',
  },
];

function mergeWithPersistedData(baseItems) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return baseItems;
    const persisted = JSON.parse(raw);
    if (!Array.isArray(persisted)) return baseItems;

    const persistedById = new Map(persisted.map((item) => [item.id, item]));
    return baseItems.map((item) => ({ ...item, ...(persistedById.get(item.id) || {}) }));
  } catch {
    return baseItems;
  }
}

export default function PATracking() {
  const [items, setItems] = useState([]);
  const [transferDrafts, setTransferDrafts] = useState({});

  const { data: orders = [] } = useQuery({
    queryKey: ['pa-tracking-orders'],
    queryFn: () => base44.entities.ProductionOrder.filter({ active: true }),
  });

  useEffect(() => {
    const orderBasedItems = mapOrdersToPAItems(orders);
    const baseItems = orderBasedItems.length > 0 ? orderBasedItems : samplePAItems;
    setItems(mergeWithPersistedData(baseItems));
  }, [orders]);

  useEffect(() => {
    if (!items.length) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const setDraft = (id, value) => {
    setTransferDrafts((prev) => ({ ...prev, [id]: value }));
  };

  const confirmTransfer = (item) => {
    const qty = Number(transferDrafts[item.id]);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error('Informe uma quantidade válida para transferir.');
      return;
    }

    if (qty > Number(item.available_qty || 0)) {
      toast.error('Quantidade maior que a disponível na fábrica.');
      return;
    }

    const now = new Date().toISOString();
    const isForro = String(item.product_type).toUpperCase() === 'FORRO';
    const transferM2 = isForro ? qty * getForroFactor(item) : 0;

    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? {
              ...row,
              transfer_qty: qty,
              transfer_m2: transferM2,
              transfer_timestamp: now,
              status: 'in_logistics',
            }
          : row
      )
    );

    setTransferDrafts((prev) => ({ ...prev, [item.id]: '' }));
    toast.success('Transferência confirmada e enviada para logística.');
  };

  const markAsDelivered = (id) => {
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              status: 'delivered',
              delivered_timestamp: now,
            }
          : row
      )
    );
    toast.success('PA marcado como entregue.');
  };

  const grouped = useMemo(() => {
    const groups = {
      factory: { count: 0, qty: 0, m2: 0 },
      in_logistics: { count: 0, qty: 0, m2: 0 },
      delivered: { count: 0, qty: 0, m2: 0 },
    };

    items.forEach((item) => {
      const status = groups[item.status] ? item.status : 'factory';
      const transferQty = Number(item.transfer_qty || 0);
      const qtyForStatus = status === 'factory' ? Number(item.available_qty || 0) : transferQty;
      const m2ForStatus = status === 'factory' ? 0 : Number(item.transfer_m2 || 0);

      groups[status].count += 1;
      groups[status].qty += qtyForStatus;
      groups[status].m2 += m2ForStatus;
    });

    return groups;
  }, [items]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold">PA Tracking</h1>
          <p className="text-sm text-muted-foreground">
            Transferência controlada de PA com confirmação manual de quantidade, cálculo automático para FORRO e registro de horário.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fluxo OP → Production → PA → Logistics</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={createPageUrl('Orders')}>OP</Link>
            </Button>
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
            <Button asChild variant="outline" size="sm">
              <Link to={createPageUrl('MachineSelection')}>Production</Link>
            </Button>
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
            <Button asChild size="sm">
              <Link to={createPageUrl('PATracking')}>PA</Link>
            </Button>
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
            <Badge variant="secondary">Logistics</Badge>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-sm text-muted-foreground">Factory</p>
              <p className="text-2xl font-bold">{grouped.factory.count}</p>
              <p className="text-sm">Qtd: {grouped.factory.qty.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">m²: {grouped.factory.m2.toFixed(1)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-sm text-muted-foreground">In logistics</p>
              <p className="text-2xl font-bold">{grouped.in_logistics.count}</p>
              <p className="text-sm">Qtd: {grouped.in_logistics.qty.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">m²: {grouped.in_logistics.m2.toFixed(1)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <p className="text-sm text-muted-foreground">Delivered</p>
              <p className="text-2xl font-bold">{grouped.delivered.count}</p>
              <p className="text-sm">Qtd: {grouped.delivered.qty.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">m²: {grouped.delivered.m2.toFixed(1)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Itens de PA</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OP</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Qtd disponível</TableHead>
                  <TableHead>Qtd transferência</TableHead>
                  <TableHead>m² calculado (FORRO)</TableHead>
                  <TableHead>Timestamp transferência</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      Sem itens de PA no momento.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.factory;
                    const isForro = String(item.product_type).toUpperCase() === 'FORRO';

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.op_number}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">{item.product_type} · {item.unit}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.badge}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>{Number(item.available_qty || 0).toFixed(1)}</TableCell>
                        <TableCell className="min-w-[180px]">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={transferDrafts[item.id] ?? ''}
                            onChange={(e) => setDraft(item.id, e.target.value)}
                            disabled={item.status !== 'factory'}
                            placeholder={item.status === 'factory' ? 'Ex: 120' : Number(item.transfer_qty || 0).toString()}
                          />
                        </TableCell>
                        <TableCell>
                          {isForro ? `${Number(item.transfer_m2 || 0).toFixed(2)} m²` : '—'}
                        </TableCell>
                        <TableCell>{formatDateTime(item.transfer_timestamp)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {item.status === 'factory' && (
                              <Button size="sm" onClick={() => confirmTransfer(item)}>
                                <Truck className="w-4 h-4 mr-1" /> Confirmar
                              </Button>
                            )}
                            {item.status === 'in_logistics' && (
                              <Button size="sm" variant="outline" onClick={() => markAsDelivered(item.id)}>
                                <CheckCircle2 className="w-4 h-4 mr-1" /> Marcar entregue
                              </Button>
                            )}
                            {item.status === 'delivered' && (
                              <div className="text-right text-xs text-muted-foreground">
                                <p>Entregue em</p>
                                <p>{formatDateTime(item.delivered_timestamp)}</p>
                              </div>
                            )}
                          </div>
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
          <CardContent className="p-4 text-sm text-muted-foreground flex items-start gap-2">
            <ClipboardList className="w-4 h-4 mt-0.5" />
            Para FORRO, o cálculo automático usa: <strong className="text-foreground ml-1">m² = quantidade × fator m²/caixa</strong> (padrão 2.5 quando o item não traz fator).
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

