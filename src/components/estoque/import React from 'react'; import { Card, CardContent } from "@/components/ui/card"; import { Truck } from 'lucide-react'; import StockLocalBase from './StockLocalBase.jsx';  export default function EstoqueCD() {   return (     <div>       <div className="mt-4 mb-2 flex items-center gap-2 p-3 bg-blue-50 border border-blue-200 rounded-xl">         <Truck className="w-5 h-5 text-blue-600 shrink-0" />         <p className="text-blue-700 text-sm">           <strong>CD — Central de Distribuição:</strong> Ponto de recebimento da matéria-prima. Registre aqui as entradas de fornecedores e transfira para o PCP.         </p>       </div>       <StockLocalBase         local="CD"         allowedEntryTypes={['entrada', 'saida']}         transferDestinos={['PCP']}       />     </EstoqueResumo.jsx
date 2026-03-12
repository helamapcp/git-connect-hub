import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Package, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const LOCAIS = ['CD', 'PCP', 'PMP', 'FÁBRICA'];
const LOCAL_COLORS = {
    CD: 'bg-blue-50 border-blue-200 text-blue-700',
    PCP: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    PMP: 'bg-amber-50 border-amber-200 text-amber-700',
    FÁBRICA: 'bg-emerald-50 border-emerald-200 text-emerald-700',
};

export default function EstoqueResumo({ onNavigate }) {
    const { data: balances = [] } = useQuery({
        queryKey: ['stock-balances'],
        queryFn: () => base44.entities.StockBalance.list(),
        refetchInterval: 30000
    });

    const { data: entries = [] } = useQuery({
        queryKey: ['stock-entries-recent'],
        queryFn: () => base44.entities.StockEntry.list('-data_lancamento', 20),
        refetchInterval: 30000
    });

    const totalByLocal = LOCAIS.map(local => {
        const items = balances.filter(b => b.local === local);
        const totalKg = items.reduce((s, b) => s + (b.quantidade_kg || 0), 0);
        return { local, totalKg, items };
    });

    const totalGeral = totalByLocal.reduce((s, l) => s + l.totalKg, 0);

    const localNavMap = { CD: 'cd', PCP: 'pcp', PMP: 'pmp', FÁBRICA: 'fabrica' };

    return (
        <div className="space-y-6 mt-4">
            {/* Fluxo visual */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {LOCAIS.map((local, idx) => {
                    const info = totalByLocal.find(l => l.local === local);
                    return (
                        <React.Fragment key={local}>
                            <button
                                onClick={() => onNavigate(localNavMap[local])}
                                className={cn(
                                    "flex-1 min-w-[130px] p-4 rounded-xl border-2 text-left transition-all hover:shadow-md active:scale-[0.98]",
                                    LOCAL_COLORS[local]
                                )}
                            >
                                <p className="font-bold text-lg">{local}</p>
                                <p className="text-2xl font-bold mt-1">{info?.totalKg.toFixed(0) ?? 0} kg</p>
                                <p className="text-xs mt-1 opacity-70">{info?.items.length ?? 0} materiais</p>
                            </button>
                            {idx < LOCAIS.length - 1 && (
                                <ArrowRight className="w-6 h-6 text-slate-400 shrink-0" />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* KPI total */}
            <Card className="bg-slate-50">
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-slate-500 text-sm">Total em estoque (todos os locais)</p>
                        <p className="text-3xl font-bold text-slate-900">{totalGeral.toFixed(0)} kg</p>
                    </div>
                    <Package className="w-10 h-10 text-slate-300" />
                </CardContent>
            </Card>

            {/* Por local - detalhes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {totalByLocal.map(({ local, items, totalKg }) => (
                    <Card key={local}>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center justify-between text-base">
                                <span>{local}</span>
                                <Button variant="ghost" size="sm" onClick={() => onNavigate(localNavMap[local])}>
                                    Ver detalhes →
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {items.length === 0 ? (
                                <p className="text-slate-400 text-sm text-center py-4">Nenhum saldo registrado</p>
                            ) : (
                                <div className="space-y-2">
                                    {items.slice(0, 4).map(b => (
                                        <div key={b.id} className="flex items-center justify-between text-sm">
                                            <span className="text-slate-700">{b.material_nome}</span>
                                            <span className="font-semibold text-slate-900">{(b.quantidade_kg || 0).toFixed(1)} kg</span>
                                        </div>
                                    ))}
                                    {items.length > 4 && (
                                        <p className="text-slate-400 text-xs">+{items.length - 4} materiais...</p>
                                    )}
                                    <div className="border-t pt-2 flex justify-between font-bold">
                                        <span className="text-slate-600">Total</span>
                                        <span>{totalKg.toFixed(1)} kg</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Últimos lançamentos */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Últimos Lançamentos</CardTitle>
                </CardHeader>
                <CardContent>
                    {entries.length === 0 ? (
                        <p className="text-slate-400 text-center py-6">Nenhum lançamento registrado</p>
                    ) : (
                        <div className="space-y-2">
                            {entries.map(e => (
                                <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center",
                                        e.tipo_movimento.includes('entrada') ? 'bg-emerald-100' : 'bg-red-100'
                                    )}>
                                        {e.tipo_movimento.includes('entrada')
                                            ? <TrendingUp className="w-4 h-4 text-emerald-600" />
                                            : <TrendingDown className="w-4 h-4 text-red-500" />
                                        }
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-800">{e.material_nome || 'Composto'}</p>
                                        <p className="text-xs text-slate-400">
                                            {e.local_origem} → {e.local_destino || '—'} • {new Date(e.data_lancamento).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <span className={cn("font-bold text-sm", e.tipo_movimento.includes('entrada') ? 'text-emerald-600' : 'text-red-500')}>
                                        {e.tipo_movimento.includes('saida') || e.tipo_movimento === 'transferencia_saida' ? '-' : '+'}{e.quantidade_kg?.toFixed(1)} kg
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}