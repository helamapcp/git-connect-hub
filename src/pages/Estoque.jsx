import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package } from 'lucide-react';
import EstoqueCD from '@/components/estoque/EstoqueCD.jsx';
import EstoquePCP from '@/components/estoque/EstoquePCP.jsx';
import EstoquePMP from '@/components/estoque/EstoquePMP.jsx';
import EstoqueFabrica from '@/components/estoque/EstoqueFabrica.jsx';
import EstoqueResumo from '@/components/estoque/EstoqueResumo.jsx';

const TABS = [
    { value: 'resumo', label: 'Resumo Geral' },
    { value: 'cd', label: 'CD' },
    { value: 'pcp', label: 'PCP' },
    { value: 'pmp', label: 'PMP' },
    { value: 'fabrica', label: 'Fábrica' },
];

export default function Estoque() {
    const [activeTab, setActiveTab] = useState('resumo');

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Package className="w-6 h-6 text-blue-600" />
                    Gestão de Estoque
                </h1>
                <p className="text-slate-500 text-sm mt-0.5">
                    Fluxo: CD → PCP → PMP (produção de composto) → Fábrica
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-5 w-full">
                    {TABS.map(t => (
                        <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="resumo"><EstoqueResumo onNavigate={setActiveTab} /></TabsContent>
                <TabsContent value="cd"><EstoqueCD /></TabsContent>
                <TabsContent value="pcp"><EstoquePCP /></TabsContent>
                <TabsContent value="pmp"><EstoquePMP /></TabsContent>
                <TabsContent value="fabrica"><EstoqueFabrica /></TabsContent>
            </Tabs>
        </div>
    );
}