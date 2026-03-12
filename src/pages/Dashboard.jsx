import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Factory, Package, Clock, TrendingUp, AlertTriangle,
    CheckCircle, Activity, Zap, RefreshCw, Scale
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { cn } from "@/lib/utils";

export default function Dashboard() {
    const [selectedShift, setSelectedShift] = useState('all');

    const { data: machines = [], refetch: refetchMachines } = useQuery({
        queryKey: ['dashboard-machines'],
        queryFn: () => base44.entities.Machine.filter({ active: true }),
        refetchInterval: 10000
    });

    const { data: orders = [] } = useQuery({
        queryKey: ['dashboard-orders'],
        queryFn: () => base44.entities.ProductionOrder.filter({ active: true }),
        refetchInterval: 10000
    });

    const { data: sessions = [] } = useQuery({
        queryKey: ['dashboard-sessions'],
        queryFn: () => base44.entities.Session.list('-created_date', 100),
        refetchInterval: 10000
    });

    const { data: productionEntries = [] } = useQuery({
        queryKey: ['dashboard-production'],
        queryFn: () => base44.entities.ProductionEntry.list('-timestamp', 500),
        refetchInterval: 10000
    });

    const { data: downtimes = [] } = useQuery({
        queryKey: ['dashboard-downtimes'],
        queryFn: () => base44.entities.DowntimeEvent.list('-start_time', 200),
        refetchInterval: 10000
    });

    const { data: shifts = [] } = useQuery({
        queryKey: ['shifts'],
        queryFn: () => base44.entities.Shift.filter({ active: true })
    });

    const { data: lotes = [] } = useQuery({
        queryKey: ['dashboard-lotes'],
        queryFn: () => base44.entities.MaterialLote.filter({ active: true }),
        refetchInterval: 30000
    });

    // ── Métricas ──────────────────────────────────────────────────
    const activeSessions = sessions.filter(s => s.status === 'active');
    const machinesInProduction = machines.filter(m => m.status === 'in_production').length;
    const machinesWithDowntime = activeSessions.filter(s => s.has_open_downtime).length;

    const totalProduced = productionEntries.reduce((sum, e) => sum + (e.quantity || 0), 0);

    // Refugo consolidado
    const totalRefugoProcesso = sessions.reduce((sum, s) => sum + (s.total_refugo_processo_kg || 0), 0);
    const totalRefugoTelhaKg = sessions.reduce((sum, s) => sum + (s.total_refugo_telha_kg || 0), 0);
    const totalRefugoKg = totalRefugoProcesso + totalRefugoTelhaKg;

    const overallEfficiency = totalProduced > 0
        ? ((totalProduced - sessions.reduce((sum, s) => sum + (s.total_loss || 0), 0)) / totalProduced * 100).toFixed(1)
        : 100;

    const ordersInProgress = orders.filter(o => ['EM_PRODUCAO', 'in_progress'].includes(o.status)).length;
    const ordersCompleted = orders.filter(o => ['FINALIZADA', 'completed'].includes(o.status)).length;
    const ordersPending = orders.filter(o => ['LIBERADA', 'PLANEJADA', 'pending'].includes(o.status)).length;
    const ordersPaused = orders.filter(o => ['PAUSADA', 'paused'].includes(o.status)).length;

    // Lotes com < 10% disponível
    const lotesQuaseFim = lotes.filter(l => l.peso_disponivel > 0 && (l.peso_disponivel / l.peso_inicial) < 0.1);

    // Charts
    const productionByMachine = machines.map(machine => {
        const prod = productionEntries.filter(e => e.machine_id === machine.id).reduce((sum, e) => sum + (e.quantity || 0), 0);
        return { name: machine.code, producao: prod };
    }).filter(m => m.producao > 0).slice(0, 8);

    const statusDistribution = [
        { name: 'Disponível', value: machines.filter(m => m.status === 'available').length, color: '#10B981' },
        { name: 'Produzindo', value: machines.filter(m => m.status === 'in_production').length, color: '#3B82F6' },
        { name: 'Manutenção', value: machines.filter(m => m.status === 'maintenance').length, color: '#F59E0B' },
        { name: 'Inativa', value: machines.filter(m => m.status === 'inactive').length, color: '#94A3B8' },
    ].filter(s => s.value > 0);

    const downtimeByCategory = downtimes.reduce((acc, d) => {
        const cat = d.reason_category || 'other';
        acc[cat] = (acc[cat] || 0) + (d.duration_minutes || 0);
        return acc;
    }, {});

    const downtimeData = Object.entries(downtimeByCategory).map(([name, value]) => ({
        name: { planned: 'Planejada', unplanned: 'Não Plan.', maintenance: 'Manutenção', setup: 'Setup', quality: 'Qualidade' }[name] || 'Outros',
        minutos: value
    }));

    // Refugo por categoria
    const refugoTelhaTotal = orders.reduce((sum, o) => sum + (o.refugo_telha_kg_total || 0), 0);
    const refugoPadraoTotal = orders.reduce((sum, o) => sum + ((o.quantity_loss || 0) - (o.refugo_telha_kg_total || 0)), 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                        <p className="text-slate-500">Visão geral da produção em tempo real</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Select value={selectedShift} onValueChange={setSelectedShift}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Turno" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos Turnos</SelectItem>
                                {shifts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" onClick={() => refetchMachines()}>
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Alertas de lotes */}
                {lotesQuaseFim.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-red-800">Lotes de composto com estoque crítico:</p>
                            <p className="text-xs text-red-700">{lotesQuaseFim.map(l => `${l.codigo_lote} (${l.peso_disponivel?.toFixed(1)} kg)`).join(' • ')}</p>
                        </div>
                    </div>
                )}

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-100 text-sm">Máquinas Ativas</p>
                                    <p className="text-3xl font-bold mt-1">{machinesInProduction}</p>
                                    <p className="text-blue-200 text-xs mt-1">de {machines.length} total</p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Factory className="w-6 h-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-emerald-100 text-sm">Produção Total</p>
                                    <p className="text-3xl font-bold mt-1">{totalProduced.toFixed(0)}</p>
                                    <p className="text-emerald-200 text-xs mt-1">unidades/caixas</p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                    <TrendingUp className="w-6 h-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-violet-500 to-violet-600 text-white border-0">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-violet-100 text-sm">Eficiência</p>
                                    <p className="text-3xl font-bold mt-1">{overallEfficiency}%</p>
                                    <p className="text-violet-200 text-xs mt-1">geral</p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Zap className="w-6 h-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={cn("border-0 text-white",
                        machinesWithDowntime > 0 ? "bg-gradient-to-br from-red-500 to-red-600" : "bg-gradient-to-br from-slate-500 to-slate-600"
                    )}>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-red-100 text-sm">Paradas Ativas</p>
                                    <p className="text-3xl font-bold mt-1">{machinesWithDowntime}</p>
                                    <p className="text-red-200 text-xs mt-1">máquinas</p>
                                </div>
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Refugo cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="p-5">
                            <p className="text-sm text-red-600 mb-1">Refugo Total (KG)</p>
                            <p className="text-3xl font-bold text-red-700">{totalRefugoKg.toFixed(2)}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-orange-200 bg-orange-50">
                        <CardContent className="p-5">
                            <p className="text-sm text-orange-600 mb-1">Refugo Telha Convertido (KG)</p>
                            <p className="text-3xl font-bold text-orange-700">{totalRefugoTelhaKg.toFixed(2)}</p>
                            <p className="text-xs text-orange-500 mt-1">calculado por peso médio × UN</p>
                        </CardContent>
                    </Card>
                    <Card className="border-pink-200 bg-pink-50">
                        <CardContent className="p-5">
                            <p className="text-sm text-pink-600 mb-1">Refugo Processo (KG)</p>
                            <p className="text-3xl font-bold text-pink-700">{totalRefugoProcesso.toFixed(2)}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><CardTitle className="text-lg">Produção por Máquina</CardTitle></CardHeader>
                        <CardContent>
                            {productionByMachine.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={productionByMachine}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip />
                                        <Bar dataKey="producao" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-[280px] flex items-center justify-center text-slate-400">
                                    <div className="text-center"><Activity className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Sem dados</p></div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-lg">Status das Máquinas</CardTitle></CardHeader>
                        <CardContent>
                            {statusDistribution.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                                            label={({ name, value }) => `${name}: ${value}`}>
                                            {statusDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                        </Pie>
                                        <Tooltip /><Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-[280px] flex items-center justify-center text-slate-400">
                                    <div className="text-center"><Factory className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Nenhuma máquina</p></div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Ordens + Paradas */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><Package className="w-5 h-5" />Ordens</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                <span className="text-blue-700 text-sm">Em Produção</span>
                                <Badge className="bg-blue-100 text-blue-700">{ordersInProgress}</Badge>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                <span className="text-slate-700 text-sm">Pendentes</span>
                                <Badge className="bg-slate-100 text-slate-700">{ordersPending}</Badge>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                                <span className="text-amber-700 text-sm flex items-center gap-1"><Clock className="w-4 h-4" />Pausadas</span>
                                <Badge className="bg-amber-100 text-amber-700">{ordersPaused}</Badge>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                                <span className="text-emerald-700 text-sm">Concluídas</span>
                                <Badge className="bg-emerald-100 text-emerald-700">{ordersCompleted}</Badge>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><Clock className="w-5 h-5" />Paradas por Categoria</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {downtimeData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={downtimeData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                        <XAxis type="number" tick={{ fontSize: 12 }} />
                                        <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
                                        <Tooltip formatter={(v) => `${v} min`} />
                                        <Bar dataKey="minutos" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-[200px] flex items-center justify-center text-slate-400">
                                    <div className="text-center"><CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Sem paradas</p></div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sessões Ativas */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2"><Activity className="w-5 h-5" />Sessões Ativas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {activeSessions.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <Factory className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>Nenhuma sessão ativa</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {activeSessions.map(s => (
                                    <div key={s.id} className={cn("p-4 rounded-xl border-2",
                                        s.has_open_downtime ? "border-red-200 bg-red-50" :
                                            s.order_type === 'PEDIDO' ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
                                    )}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-slate-900">{s.machine_code}</span>
                                            <div className="flex gap-1">
                                                {s.order_type === 'PEDIDO' && <Badge className="bg-amber-100 text-amber-700 text-xs">PEDIDO</Badge>}
                                                <Badge className={cn("text-xs",
                                                    s.has_open_downtime ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                                                )}>
                                                    {s.has_open_downtime ? 'Parada' : 'Produzindo'}
                                                </Badge>
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-600 mb-1">Ordem: {s.order_number}</p>
                                        <p className="text-sm text-slate-600 mb-2">Operador: {s.operator_name}</p>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Produzido:</span>
                                                <span className="font-semibold text-emerald-600">{s.total_produced || 0}</span>
                                            </div>
                                            {(s.total_refugo_processo_kg > 0 || s.total_refugo_telha_kg > 0) && (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Refugo Total:</span>
                                                    <span className="font-semibold text-red-600">
                                                        {((s.total_refugo_processo_kg || 0) + (s.total_refugo_telha_kg || 0)).toFixed(2)} kg
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}