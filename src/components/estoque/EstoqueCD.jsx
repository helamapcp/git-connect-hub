import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Truck } from 'lucide-react';

export default function EstoqueCD() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5" />
          <h2 className="font-semibold">CD — Central de Distribuição</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Ponto de recebimento da matéria-prima e envio para o PCP.
        </p>
      </CardContent>
    </Card>
  );
}
