import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
    Package, Factory, AlertTriangle, ArrowRight, RefreshCw,
    Boxes, TrendingDown, CheckCircle2, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

const BAG_STATUS_CONFIG = {
    stored: { label: 'Armazenada', color: 'bg-emerald-100 text-emerald-700' },
    transferred: { label: 'Transferida', color: 'bg-blue-100 text-blue-700' },
    reserved: { label: 'Reservada', color: 'bg-amber-100 text-amber-700' },
    consumed: { label: 'Consumida', color: 'bg-slate-100 text-slate-500' },
};

export default function FactoryDashboard() {
    const { data: bags = [], refetch } = useQuery({
        queryKey: ['factory-bags'],
        queryFn: () => base44.entities.ProductionBag.filter({ active: true }),
        refetchInterval: 15000
    });

    const { data: machines = [] } = useQuery({
        queryKey: ['factory-machines'],
        queryFn: () => base44.entities.Machine.filter({ active: true }),
        refetchInterval: 15000
    });

    const { data: consumptions = [] } = useQuery({
        queryKey: ['factory-consumptions-today'],
        queryFn: async () => {
            const all = await base44.entities.MachineConsumption.list('-timestamp', 200);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            return all.filter(c => new Date(c.timestamp) >= today);
        },
        refetchInterval: 15000
    });

    const bagsInPMP = bags.filter(b => b.location_code === 'PMP' && b.status !== 'consumed');
    const bagsInFabrica = bags.filter(b => b.location_code === 'FÁBRICA' && b.status !== 'consumed');
    const bagsReserved = bags.filter(b => b.status === 'reserved');
    const bagsConsumed = bags.filter(b => b.status === 'consumed');

    const kgInPMP = bagsInPMP.reduce((s, b) => s + (b.remaining_kg ?? b.weight_kg ?? 0), 0);
    const kgInFabrica = bagsInFabrica.reduce((s, b) => s + (b.remaining_kg ?? b.weight_kg ?? 0), 0);
    const kgConsumedToday = consumptions.reduce((s, c) => s + (c.consumed_kg || 0), 0);

    const LOW_STOCK_THRESHOLD = 100; // kg
    const isLowStock = kgInFabrica < LOW_STOCK_THRESHOLD;

    const machinesInProduction = machines.filter(m => m.status === 'in_production');

    // Group today consumptions by machine
    const byMachine = machinesInProduction.map(m => {
        const mConsumptions = consumptions.filter(c => c.machine_id === m.id);
        const totalKg = mConsumptions.reduce((s, c) => s + (c.consumed_kg || 0), 0);
        return { ...m, todayKg: totalKg, totalConsumptions: mConsumptions.length };
    });

    // Unique batches available in FÁBRICA
    const batchesInFabrica = [...new Set(bagsInFabrica.map(b => b.batch_code).filter(Boolean))];

    return (
        <div className="p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Factory className="w-7 h-7 text-blue-600" />
                            Dashboard Fábrica
                        </h1>
                        <p className="text-slate-500 text-sm mt-0.5">Controle de sacolas e consumo de composto</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" onClick={() => refetch()}>
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Link to={createPageUrl('BagTransfer')}>
                            <Button className="bg-blue-600 hover:bg-blue-700">
                                <ArrowRight className="w-4 h-4 mr-2" /> Transferir Sacolas
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Low stock alert */}
                {isLowStock && (
                    <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
                        <div>
                            <p className="text-red-700 font-semibold">Estoque crítico na FÁBRICA</p>
                            <p className="text-red-600 text-sm">Apenas {kgInFabrica.toFixed(1)} kg disponíveis. Realize uma transferência do PMP.</p>
                        </div>
                    </div>
                )}

                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-500 text-sm">Sacolas no PMP</p>
                                    <p className="text-3xl font-bold text-slate-900 mt-1">{bagsInPMP.length}</p>
                                    <p className="text-slate-400 text-xs mt-1">{kgInPMP.toFixed(1)} kg</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <Boxes className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={cn(isLowStock ? "border-red-300 bg-red-50" : "")}>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className={cn("text-sm", isLowStock ? "text-red-600" : "text-slate-500")}>Sacolas na FÁBRICA</p>
                                    <p className="text-3xl font-bold text-slate-900 mt-1">{bagsInFabrica.length}</p>
                                    <p className={cn("text-xs mt-1", isLowStock ? "text-red-500" : "text-slate-400")}>{kgInFabrica.toFixed(1)} kg</p>
                                </div>
                                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", isLowStock ? "bg-red-100" : "bg-emerald-100")}>
                                    {isLowStock ? <AlertTriangle className="w-6 h-6 text-red-500" /> : <CheckCircle2 className="w-6 h-6 text-emerald-600" />}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-500 text-sm">Reservadas</p>
                                    <p className="text-3xl font-bold text-slate-900 mt-1">{bagsReserved.length}</p>
                                    <p className="text-slate-400 text-xs mt-1">em uso nas máquinas</p>
                                </div>
                                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-amber-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-500 text-sm">Consumo Hoje</p>
                                    <p className="text-3xl font-bold text-slate-900 mt-1">{kgConsumedToday.toFixed(1)}</p>
                                    <p className="text-slate-400 text-xs mt-1">kg consumidos</p>
                                </div>
                                <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                                    <TrendingDown className="w-6 h-6 text-violet-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link to={createPageUrl('BagTransfer')}>
                        <Card className="hover:border-blue-400 hover:shadow-md cursor-pointer transition-all active:scale-[0.98]">
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                                    <ArrowRight className="w-7 h-7 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-slate-900 font-bold text-lg">Transferir PMP → Fábrica</p>
                                    <p className="text-slate-500 text-sm">{bagsInPMP.length} sacolas disponíveis</p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link to={createPageUrl('MachineConsumption')}>
                        <Card className="hover:border-emerald-400 hover:shadow-md cursor-pointer transition-all active:scale-[0.98]">
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center">
                                    <Factory className="w-7 h-7 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-slate-900 font-bold text-lg">Consumo de Máquina</p>
                                    <p className="text-slate-500 text-sm">{bagsInFabrica.length} sacolas na fábrica</p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link to={createPageUrl('BagInventory')}>
                        <Card className="hover:border-violet-400 hover:shadow-md cursor-pointer transition-all active:scale-[0.98]">
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center">
                                    <Package className="w-7 h-7 text-violet-600" />
                                </div>
                                <div>
                                    <p className="text-slate-900 font-bold text-lg">Inventário de Sacolas</p>
                                    <p className="text-slate-500 text-sm">Rastreabilidade completa</p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                </div>

                {/* Machine Status + Batches */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Factory className="w-5 h-5 text-blue-600" /> Máquinas Ativas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {machinesInProduction.length === 0 ? (
                                <p className="text-slate-400 text-center py-6">Nenhuma máquina em produção</p>
                            ) : (
                                <div className="space-y-3">
                                    {byMachine.filter(m => m.status === 'in_production').map(m => (
                                        <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                            <div>
                                                <p className="text-slate-800 font-semibold">{m.code}</p>
                                                <p className="text-slate-400 text-xs">{m.name}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-emerald-600 font-bold">{m.todayKg.toFixed(1)} kg</p>
                                                <p className="text-slate-400 text-xs">consumidos hoje</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Boxes className="w-5 h-5 text-emerald-600" /> Lotes na FÁBRICA
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {batchesInFabrica.length === 0 ? (
                                <p className="text-slate-400 text-center py-6">Nenhum lote na fábrica</p>
                            ) : (
                                <div className="space-y-3">
                                    {batchesInFabrica.map(batch => {
                                        const batchBags = bagsInFabrica.filter(b => b.batch_code === batch);
                                        const batchKg = batchBags.reduce((s, b) => s + (b.remaining_kg ?? b.weight_kg ?? 0), 0);
                                        return (
                                            <div key={batch} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                                <div>
                                                    <p className="text-slate-800 font-mono text-sm font-semibold">{batch}</p>
                                                    <p className="text-slate-400 text-xs">{batchBags.length} sacolas</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-emerald-600 font-bold">{batchKg.toFixed(1)} kg</p>
                                                    <Badge className={batchKg < 50 ? 'bg-red-100 text-red-700 text-xs' : 'bg-emerald-100 text-emerald-700 text-xs'}>
                                                        {batchKg < 50 ? 'Baixo' : 'OK'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}