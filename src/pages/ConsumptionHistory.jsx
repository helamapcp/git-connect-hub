import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock, Factory, RefreshCw, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ConsumptionHistory() {
    const [filterMachine, setFilterMachine] = useState('all');
    const [filterDate, setFilterDate] = useState('today');

    const { data: machines = [] } = useQuery({
        queryKey: ['history-machines'],
        queryFn: () => base44.entities.Machine.filter({ active: true })
    });

    const { data: consumptions = [], isLoading, refetch } = useQuery({
        queryKey: ['history-consumptions'],
        queryFn: () => base44.entities.MachineConsumption.list('-timestamp', 500),
        refetchInterval: 30000
    });

    // Filter by date
    const filteredByDate = consumptions.filter(c => {
        if (filterDate === 'all') return true;
        const cDate = new Date(c.timestamp);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (filterDate === 'today') return cDate >= today;
        if (filterDate === 'week') {
            const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
            return cDate >= weekAgo;
        }
        return true;
    });

    const filtered = filteredByDate.filter(c =>
        filterMachine === 'all' || c.machine_id === filterMachine
    );

    // Stats
    const totalKg = filtered.reduce((s, c) => s + (c.consumed_kg || 0), 0);
    const machinesUsed = [...new Set(filtered.map(c => c.machine_id))].length;
    const batchesConsumed = [...new Set(filtered.map(c => c.batch_code).filter(Boolean))].length;

    // Group by machine
    const byMachine = filtered.reduce((acc, c) => {
        const key = c.machine_id || 'unknown';
        if (!acc[key]) acc[key] = { machine_code: c.machine_code, items: [], totalKg: 0 };
        acc[key].items.push(c);
        acc[key].totalKg += c.consumed_kg || 0;
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to={createPageUrl('FactoryDashboard')}>
                            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                <Clock className="w-6 h-6 text-violet-600" /> Histórico de Consumo
                            </h1>
                            <p className="text-slate-500 text-sm">Consumo por máquina com rastreabilidade completa</p>
                        </div>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-violet-50 border-violet-200">
                        <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-violet-700">{totalKg.toFixed(1)}</p>
                            <p className="text-sm text-violet-600">kg consumidos</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-blue-700">{filtered.length}</p>
                            <p className="text-sm text-blue-600">eventos</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-50 border-emerald-200">
                        <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-emerald-700">{batchesConsumed}</p>
                            <p className="text-sm text-emerald-600">lotes diferentes</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="p-4 flex flex-wrap gap-3">
                        <Select value={filterMachine} onValueChange={setFilterMachine}>
                            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Máquina" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as máquinas</SelectItem>
                                {machines.map(m => <SelectItem key={m.id} value={m.id}>{m.code} — {m.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filterDate} onValueChange={setFilterDate}>
                            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="today">Hoje</SelectItem>
                                <SelectItem value="week">Últimos 7 dias</SelectItem>
                                <SelectItem value="all">Tudo</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                {/* By machine */}
                {isLoading ? (
                    <Card><CardContent className="p-12 text-center text-slate-400">Carregando...</CardContent></Card>
                ) : Object.keys(byMachine).length === 0 ? (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <TrendingDown className="w-14 h-14 mx-auto mb-4 text-slate-300" />
                            <p className="text-slate-500 text-lg">Nenhum registro encontrado</p>
                        </CardContent>
                    </Card>
                ) : Object.entries(byMachine).map(([machineId, data]) => (
                    <Card key={machineId}>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Factory className="w-5 h-5 text-blue-600" />
                                    {data.machine_code || 'Máquina'}
                                </span>
                                <Badge className="bg-blue-100 text-blue-700 text-base px-3 py-1">
                                    {data.totalKg.toFixed(2)} kg total
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {data.items.map(c => (
                                <div key={c.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                                    <div className="text-center min-w-[60px]">
                                        <p className="text-slate-800 font-bold text-sm">
                                            {format(new Date(c.timestamp), 'HH:mm')}
                                        </p>
                                        <p className="text-slate-400 text-xs">
                                            {format(new Date(c.timestamp), 'dd/MM', { locale: ptBR })}
                                        </p>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-slate-800 font-medium">
                                            Sacola #{c.bag_number}
                                            {c.full_consumption
                                                ? <Badge className="ml-2 bg-emerald-100 text-emerald-700 text-xs">Inteira</Badge>
                                                : <Badge className="ml-2 bg-amber-100 text-amber-700 text-xs">Parcial</Badge>
                                            }
                                        </p>
                                        <p className="text-slate-500 text-xs font-mono">{c.batch_code}</p>
                                        {c.product_name && <p className="text-slate-500 text-xs">{c.product_name}</p>}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-emerald-700 font-bold text-lg">{c.consumed_kg.toFixed(2)} kg</p>
                                        <p className="text-slate-400 text-xs">{c.operator_name || '—'}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}