import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Package, Search, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
    stored: { label: 'Armazenada', color: 'bg-emerald-100 text-emerald-700' },
    transferred: { label: 'Transferida', color: 'bg-blue-100 text-blue-700' },
    reserved: { label: 'Reservada', color: 'bg-amber-100 text-amber-700' },
    consumed: { label: 'Consumida', color: 'bg-slate-100 text-slate-500' },
};

const LOCATION_CONFIG = {
    PMP: { label: 'PMP', color: 'bg-indigo-100 text-indigo-700' },
    FÁBRICA: { label: 'FÁBRICA', color: 'bg-blue-100 text-blue-700' },
    CONSUMED: { label: 'Consumida', color: 'bg-slate-100 text-slate-500' },
};

export default function BagInventory() {
    const [search, setSearch] = useState('');
    const [filterLocation, setFilterLocation] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterBatch, setFilterBatch] = useState('all');

    const { data: bags = [], isLoading, refetch } = useQuery({
        queryKey: ['inventory-bags'],
        queryFn: () => base44.entities.ProductionBag.filter({ active: true }),
        refetchInterval: 30000
    });

    const batches = [...new Set(bags.map(b => b.batch_code).filter(Boolean))].sort();

    const filtered = bags.filter(b => {
        const matchSearch = !search ||
            b.batch_code?.toLowerCase().includes(search.toLowerCase()) ||
            b.product_name?.toLowerCase().includes(search.toLowerCase()) ||
            String(b.bag_number).includes(search);
        const matchLocation = filterLocation === 'all' || b.location_code === filterLocation;
        const matchStatus = filterStatus === 'all' || b.status === filterStatus;
        const matchBatch = filterBatch === 'all' || b.batch_code === filterBatch;
        return matchSearch && matchLocation && matchStatus && matchBatch;
    });

    const totalKg = filtered.reduce((s, b) => s + (b.remaining_kg ?? b.weight_kg ?? 0), 0);
    const countByLocation = {
        PMP: bags.filter(b => b.location_code === 'PMP' && b.status !== 'consumed').length,
        FÁBRICA: bags.filter(b => b.location_code === 'FÁBRICA' && b.status !== 'consumed').length,
    };
    const countConsumed = bags.filter(b => b.status === 'consumed').length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to={createPageUrl('FactoryDashboard')}>
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                <Package className="w-6 h-6 text-blue-600" /> Inventário de Sacolas
                            </h1>
                            <p className="text-slate-500 text-sm">Rastreabilidade completa por sacola</p>
                        </div>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => refetch()}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-indigo-50 border-indigo-200">
                        <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-indigo-700">{countByLocation.PMP}</p>
                            <p className="text-sm text-indigo-600">No PMP</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-blue-700">{countByLocation.FÁBRICA}</p>
                            <p className="text-sm text-blue-600">Na Fábrica</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-50 border-slate-200">
                        <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-slate-700">{countConsumed}</p>
                            <p className="text-sm text-slate-600">Consumidas</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-50 border-emerald-200">
                        <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-emerald-700">{totalKg.toFixed(0)}</p>
                            <p className="text-sm text-emerald-600">kg (filtro atual)</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="p-4 flex flex-wrap gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar por lote, produto, número..." className="pl-9" />
                        </div>
                        <Select value={filterLocation} onValueChange={setFilterLocation}>
                            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Local" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os locais</SelectItem>
                                <SelectItem value="PMP">PMP</SelectItem>
                                <SelectItem value="FÁBRICA">FÁBRICA</SelectItem>
                                <SelectItem value="CONSUMED">Consumidas</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos status</SelectItem>
                                <SelectItem value="stored">Armazenada</SelectItem>
                                <SelectItem value="transferred">Transferida</SelectItem>
                                <SelectItem value="reserved">Reservada</SelectItem>
                                <SelectItem value="consumed">Consumida</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filterBatch} onValueChange={setFilterBatch}>
                            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Lote" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os lotes</SelectItem>
                                {batches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                {/* Table */}
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Lote</TableHead>
                                    <TableHead>Produto</TableHead>
                                    <TableHead>Sacola #</TableHead>
                                    <TableHead className="text-right">Peso (kg)</TableHead>
                                    <TableHead className="text-right">Restante (kg)</TableHead>
                                    <TableHead>Local</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Operador</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <TableRow key={i}>
                                            {Array(8).fill(0).map((_, j) => (
                                                <TableCell key={j}><div className="h-4 bg-slate-200 rounded animate-pulse w-20" /></TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                                            <Package className="w-12 h-12 mx-auto mb-2 opacity-40" />
                                            Nenhuma sacola encontrada
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.map(bag => {
                                    const statusCfg = STATUS_CONFIG[bag.status] || STATUS_CONFIG.stored;
                                    const locCfg = LOCATION_CONFIG[bag.location_code] || LOCATION_CONFIG.PMP;
                                    return (
                                        <TableRow key={bag.id} className={bag.status === 'consumed' ? 'opacity-50' : ''}>
                                            <TableCell className="font-mono text-xs">{bag.batch_code || '—'}</TableCell>
                                            <TableCell className="font-medium">{bag.product_name || '—'}</TableCell>
                                            <TableCell className="font-bold font-mono">#{bag.bag_number}</TableCell>
                                            <TableCell className="text-right">{(bag.weight_kg || 0).toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-semibold text-emerald-600">
                                                {(bag.remaining_kg ?? bag.weight_kg ?? 0).toFixed(2)}
                                            </TableCell>
                                            <TableCell><Badge className={locCfg.color}>{locCfg.label}</Badge></TableCell>
                                            <TableCell><Badge className={statusCfg.color}>{statusCfg.label}</Badge></TableCell>
                                            <TableCell className="text-slate-500 text-xs">{bag.operator_name || '—'}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}