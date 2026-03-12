import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
import EstoqueCD from '@/components/estoque/EstoqueCD.jsx';
import EstoquePCP from '@/components/estoque/EstoquePCP.jsx';
import EstoquePMP from '@/components/estoque/EstoquePMP.jsx';
import EstoqueFabrica from '@/components/estoque/EstoqueFabrica.jsx';
import EstoqueLogistica from '@/components/estoque/EstoqueLogistica.jsx';
import EstoqueResumo from '@/components/estoque/EstoqueResumo.jsx';

const TABS = [
  { value: 'resumo', label: 'Resumo Geral' },
  { value: 'cd', label: 'CD' },
  { value: 'pcp', label: 'PCP' },
  { value: 'pmp', label: 'PMP' },
  { value: 'fabrica', label: 'Fábrica' },
  { value: 'logistica', label: 'Logística' },
];

export default function Estoque() {
  const [activeTab, setActiveTab] = useState('resumo');

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Package className="w-6 h-6 text-primary" />
          Gestão de Estoque
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Fluxo: CD → PCP → PMP → Fábrica → Logística
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Instruções de uso e build</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>1) Para desenvolvimento: <Badge variant="secondary">npm run dev</Badge></p>
          <p>2) Para build padrão: <Badge variant="secondary">npm run build</Badge></p>
          <p>3) Para build de desenvolvimento: <Badge variant="secondary">npm run build:dev</Badge></p>
          <p>4) Valide abas CD, PCP, PMP, Fábrica e Logística para garantir carregamento correto.</p>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full h-auto">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="resumo"><EstoqueResumo onNavigate={setActiveTab} /></TabsContent>
        <TabsContent value="cd"><EstoqueCD /></TabsContent>
        <TabsContent value="pcp"><EstoquePCP /></TabsContent>
        <TabsContent value="pmp"><EstoquePMP /></TabsContent>
        <TabsContent value="fabrica"><EstoqueFabrica /></TabsContent>
        <TabsContent value="logistica"><EstoqueLogistica /></TabsContent>
      </Tabs>
    </div>
  );
}
