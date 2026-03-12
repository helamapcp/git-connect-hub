import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, PackageCheck, Truck, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';

const FLOW_STEPS = [
  { key: 'op', label: 'OP', page: 'Orders' },
  { key: 'production', label: 'Production', page: 'MachineSelection' },
  { key: 'pa', label: 'PA', page: 'PATracking' },
  { key: 'logistics', label: 'Logistics', page: 'FactoryDashboard' },
];

const statusConfig = {
  factory_available: { label: 'Disponível na Fábrica', tone: 'bg-secondary text-secondary-foreground' },
  in_logistics: { label: 'Em Logística', tone: 'bg-accent text-accent-foreground' },
  delivered: { label: 'Entregue', tone: 'bg-primary text-primary-foreground' },
};

export default function PATracking() {
  const [shipmentState, setShipmentState] = useState({});

  const { data: orders = [] } = useQuery({
    queryKey: ['pa-orders'],
    queryFn: () => base44.entities.ProductionOrder.filter({ active: true }),
  });

  const completedOrders = useMemo(
    () => orders.filter((order) => ['FINALIZADA', 'completed'].includes(order.status)),
    [orders]
  );

  const paRows = useMemo(
    () =>
      completedOrders.map((order) => ({
        id: order.id,
        orderNumber: order.order_number,
        productName: order.product_name,
        producedQty: order.quantity_produced || 0,
        unit: order.unidade_producao || order.unit || 'UNIDADE',
        status: shipmentState[order.id] || 'factory_available',
      })),
    [completedOrders, shipmentState]
  );

  const kpis = paRows.reduce(
    (acc, row) => {
      if (row.status === 'factory_available') acc.factory += 1;
      if (row.status === 'in_logistics') acc.logistics += 1;
      if (row.status === 'delivered') acc.delivered += 1;
      return acc;
    },
    { factory: 0, logistics: 0, delivered: 0 }
  );

  const handleSendToLogistics = (id) => {
    setShipmentState((prev) => ({ ...prev, [id]: 'in_logistics' }));
  };

  const handleMarkDelivered = (id) => {
    setShipmentState((prev) => ({ ...prev, [id]: 'delivered' }));
  };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PackageCheck className="w-6 h-6 text-primary" />
              Rastreio de Produto Acabado (PA)
            </h1>
            <p className="text-sm text-muted-foreground">
              Etapa após produção: PA disponível na fábrica e envio para logística.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to={createPageUrl('Orders')}><Button variant="outline">OP</Button></Link>
            <Link to={createPageUrl('MachineSelection')}><Button variant="outline">Production</Button></Link>
            <Link to={createPageUrl('FactoryDashboard')}><Button>Logistics</Button></Link>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Workflow className="w-4 h-4 text-primary" /> Fluxo atualizado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {FLOW_STEPS.map((step, index) => (
                <React.Fragment key={step.key}>
                  <Link to={createPageUrl(step.page)}>
                    <div className={cn(
                      'rounded-lg border p-3 text-sm transition-colors hover:bg-muted',
                      step.key === 'pa' ? 'border-primary bg-primary/10 font-semibold' : 'border-border'
                    )}>
                      {step.label}
                    </div>
                  </Link>
                  {index < FLOW_STEPS.length - 1 && (
                    <div className="hidden md:flex items-center justify-center text-muted-foreground">→</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">PA na fábrica</p><p className="text-3xl font-bold">{kpis.factory}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">PA em logística</p><p className="text-3xl font-bold">{kpis.logistics}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">PA entregue</p><p className="text-3xl font-bold">{kpis.delivered}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Disponibilidade e expedição de PA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {paRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma OP finalizada ainda. Finalize uma OP para liberar PA nesta etapa.</p>
            ) : (
              paRows.map((row) => {
                const status = statusConfig[row.status];
                return (
                  <div key={row.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="font-semibold">{row.orderNumber} · {row.productName}</p>
                        <p className="text-sm text-muted-foreground">Produzido: {row.producedQty} {row.unit}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={status.tone}>{status.label}</Badge>
                        {row.status === 'factory_available' && (
                          <Button size="sm" onClick={() => handleSendToLogistics(row.id)}>
                            <Truck className="w-4 h-4 mr-1" /> Enviar para logística
                          </Button>
                        )}
                        {row.status === 'in_logistics' && (
                          <Button size="sm" variant="secondary" onClick={() => handleMarkDelivered(row.id)}>
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Marcar entregue
                          </Button>
                        )}
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <p className="text-xs text-muted-foreground">Status visual frontend-only para acompanhamento do fluxo PA → Logistics.</p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
