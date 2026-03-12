import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Factory } from 'lucide-react';

export default function EstoqueFabrica() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        <div className="flex items-center gap-2">
          <Factory className="w-5 h-5" />
          <h2 className="font-semibold">Fábrica</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Recebimento de composto e consumo operacional no chão de fábrica.
        </p>
      </CardContent>
    </Card>
  );
}
