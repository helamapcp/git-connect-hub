import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EstoqueResumo({ onNavigate }) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          <h2 className="font-semibold">Resumo Geral</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Visualização consolidada do fluxo de estoque entre CD, PCP, PMP e Fábrica.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => onNavigate?.('cd')}>Ir para CD</Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate?.('pcp')}>Ir para PCP</Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate?.('pmp')}>Ir para PMP</Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate?.('fabrica')}>Ir para Fábrica</Button>
        </div>
      </CardContent>
    </Card>
  );
}
