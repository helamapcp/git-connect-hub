import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Package, CheckCircle2, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function BagTransfer() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    const [search, setSearch] = useState('');
    const [filterBatch, setFilterBatch] = useState('all');
    const [selectedBags, setSelectedBags] = useState(new Set());
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        base44.auth.me().then(setUser).catch(() => { });
    }, []);

    const { data: bags = [], refetch } = useQuery({
        queryKey: ['transfer-bags-pmp'],
        queryFn: () => base44.entities.ProductionBag.filter({ active: true }),
        select: (all) => all.filter(b => b.location_code === 'PMP' && b.status === 'stored')
    });

    const batches = [...new Set(bags.map(b => b.batch_code).filter(Boolean))];

    const filteredBags = bags.filter(b => {
        const matchSearch = !search ||
            b.batch_code?.toLowerCase().includes(search.toLowerCase()) ||
            b.product_name?.toLowerCase().includes(search.toLowerCase()) ||
            String(b.bag_number).includes(search);
        const matchBatch = filterBatch === 'all' || b.batch_code === filterBatch;
        return matchSearch && matchBatch;
    });

    const selectedBagObjects = bags.filter(b => selectedBags.has(b.id));
    const totalKgSelected = selectedBagObjects.reduce((s, b) => s + (b.remaining_kg ?? b.weight_kg ?? 0), 0);

    const toggleBag = (id) => {
        setSelectedBags(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedBags.size === filteredBags.length) {
            setSelectedBags(new Set());
        } else {
            setSelectedBags(new Set(filteredBags.map(b => b.id)));
        }
    };

    const handleTransfer = async () => {
        if (selectedBags.size === 0) { toast.error('Selecione ao menos uma sacola'); return; }
        setSubmitting(true);
        const now = new Date().toISOString();
        // Generate transfer number
        const transfers = await base44.entities.BagTransfer.list('-created_date', 1);
        const lastNum = transfers.length > 0
            ? parseInt((transfers[0].transfer_number || 'T-00000').replace('T-', '')) + 1
            : 1;
        const transferNumber = `T-${String(lastNum).padStart(5, '0')}`;

        const bagIds = JSON.stringify([...selectedBags]);
        // Create transfer record
        const transfer = await base44.entities.BagTransfer.create({
            transfer_number: transferNumber,
            origin_location: 'PMP',
            destination_location: 'FÁBRICA',
            bag_ids: bagIds,
            total_bags: selectedBags.size,
            total_kg: totalKgSelected,
            operator_id: user?.id,
            operator_name: user?.full_name,
            transfer_date: now
        });

        // Update each bag
        await Promise.all(selectedBagObjects.map(bag =>
            base44.entities.ProductionBag.update(bag.id, {
                location_code: 'FÁBRICA',
                status: 'transferred'
            })
        ));

        // Stock movements: out from PMP, in to FÁBRICA
        const batchGroups = selectedBagObjects.reduce((acc, b) => {
            const key = b.batch_code || 'unknown';
            acc[key] = (acc[key] || 0) + (b.remaining_kg ?? b.weight_kg ?? 0);
            return acc;
        }, {});

        await Promise.all(
            Object.entries(batchGroups).flatMap(([batch, kg]) => [
                base44.entities.StockMovement.create({
                    batch_code: batch,
                    location_code: 'PMP',
                    movement_type: 'transfer_out',
                    total_kg: -kg,
                    reference_id: transfer.id,
                    operator_id: user?.id,
                    operator_name: user?.full_name,
                    timestamp: now
                }),
                base44.entities.StockMovement.create({
                    batch_code: batch,
                    location_code: 'FÁBRICA',
                    movement_type: 'transfer_in',
                    total_kg: kg,
                    reference_id: transfer.id,
                    operator_id: user?.id,
                    operator_name: user?.full_name,
                    timestamp: now
                })
            ])
        );

        queryClient.invalidateQueries(['transfer-bags-pmp']);
        queryClient.invalidateQueries(['factory-bags']);
        setSelectedBags(new Set());
        toast.success(`Transferência ${transferNumber} registrada! ${selectedBags.size} sacolas → FÁBRICA`);
        setSubmitting(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 md:p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link to={createPageUrl('FactoryDashboard')}>
                        <Button variant="ghost" size="icon" className="text-slate-300 hover:bg-slate-700">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white">Transferência PMP → FÁBRICA</h1>
                        <p className="text-slate-400 text-sm">Selecione as sacolas para transferir</p>
                    </div>
                </div>

                {/* Selected summary bar */}
                {selectedBags.size > 0 && (
                    <div className="bg-blue-900/50 border border-blue-600 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <p className="text-blue-200 font-semibold">{selectedBags.size} sacola(s) selecionada(s)</p>
                            <p className="text-blue-300 text-sm">{totalKgSelected.toFixed(2)} kg total</p>
                        </div>
                        <Button
                            onClick={handleTransfer}
                            disabled={submitting}
                            className="bg-blue-600 hover:bg-blue-700 h-14 px-8 text-lg font-bold w-full md:w-auto"
                        >
                            <ArrowRight className="w-5 h-5 mr-2" />
                            {submitting ? 'Transferindo...' : 'Confirmar Transferência'}
                        </Button>
                    </div>
                )}

                {/* Filters */}
                <Card className="bg-slate-700 border-slate-600">
                    <CardContent className="p-4 flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar por lote, produto, número..."
                                className="pl-9 bg-slate-600 border-slate-500 text-white placeholder:text-slate-400"
                            />
                        </div>
                        <Select value={filterBatch} onValueChange={setFilterBatch}>
                            <SelectTrigger className="w-full md:w-[220px] bg-slate-600 border-slate-500 text-white">
                                <SelectValue placeholder="Filtrar por lote" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os lotes</SelectItem>
                                {batches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={toggleAll} className="border-slate-500 text-slate-300 hover:bg-slate-600 whitespace-nowrap">
                            {selectedBags.size === filteredBags.length ? 'Desmarcar todos' : 'Selecionar todos'}
                        </Button>
                    </CardContent>
                </Card>

                {/* Bag list */}
                {filteredBags.length === 0 ? (
                    <Card className="bg-slate-700 border-slate-600">
                        <CardContent className="p-12 text-center">
                            <Package className="w-16 h-16 mx-auto mb-4 text-slate-500" />
                            <p className="text-slate-400 text-lg">Nenhuma sacola disponível no PMP</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filteredBags.map(bag => {
                            const isSelected = selectedBags.has(bag.id);
                            const kg = bag.remaining_kg ?? bag.weight_kg ?? 0;
                            return (
                                <button
                                    key={bag.id}
                                    onClick={() => toggleBag(bag.id)}
                                    className={cn(
                                        "text-left p-4 rounded-xl border-2 transition-all active:scale-[0.98]",
                                        isSelected
                                            ? "border-blue-500 bg-blue-900/40"
                                            : "border-slate-600 bg-slate-700 hover:border-slate-500"
                                    )}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0",
                                                isSelected ? "border-blue-400 bg-blue-500" : "border-slate-500"
                                            )}>
                                                {isSelected && <CheckCircle2 className="w-5 h-5 text-white" />}
                                            </div>
                                            <div>
                                                <p className="text-white font-bold font-mono">Sacola #{bag.bag_number}</p>
                                                <p className="text-slate-300 text-sm">{bag.product_name || '—'}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-emerald-400 font-bold text-lg">{kg.toFixed(1)} kg</p>
                                            <p className="text-slate-400 text-xs">PMP</p>
                                        </div>
                                    </div>
                                    {bag.batch_code && (
                                        <p className="text-slate-400 text-xs mt-2 font-mono pl-11">{bag.batch_code}</p>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}