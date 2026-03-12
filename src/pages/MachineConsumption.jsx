import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Factory, Package, Scale, CheckCircle2, Clock, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const BAG_STATUS = {
    stored: { label: 'Disponível', color: 'bg-emerald-100 text-emerald-700' },
    transferred: { label: 'Disponível', color: 'bg-emerald-100 text-emerald-700' },
    reserved: { label: 'Reservada', color: 'bg-amber-100 text-amber-700' },
    consumed: { label: 'Consumida', color: 'bg-slate-100 text-slate-500' },
};

export default function MachineConsumption() {
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    const [step, setStep] = useState(1); // 1=select machine, 2=select bag, 3=enter consumption
    const [selectedMachine, setSelectedMachine] = useState(null);
    const [selectedBag, setSelectedBag] = useState(null);
    const [consumptionType, setConsumptionType] = useState('full'); // full | partial
    const [partialKg, setPartialKg] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [searchBag, setSearchBag] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        base44.auth.me().then(setUser).catch(() => { });
    }, []);

    const { data: machines = [] } = useQuery({
        queryKey: ['consumption-machines'],
        queryFn: () => base44.entities.Machine.filter({ active: true })
    });

    const { data: bags = [] } = useQuery({
        queryKey: ['consumption-bags-fabrica'],
        queryFn: () => base44.entities.ProductionBag.filter({ active: true }),
        select: all => all.filter(b =>
            b.location_code === 'FÁBRICA' && ['stored', 'transferred', 'reserved'].includes(b.status)
        )
    });

    const filteredBags = bags.filter(b => {
        if (!searchBag) return true;
        return (
            b.batch_code?.toLowerCase().includes(searchBag.toLowerCase()) ||
            b.product_name?.toLowerCase().includes(searchBag.toLowerCase()) ||
            String(b.bag_number).includes(searchBag)
        );
    });

    const availableKg = selectedBag ? (selectedBag.remaining_kg ?? selectedBag.weight_kg ?? 0) : 0;
    const consumedKg = consumptionType === 'full' ? availableKg : parseFloat(partialKg || '0');

    const handleConfirmConsumption = async () => {
        if (consumptionType === 'partial') {
            const kg = parseFloat(partialKg);
            if (!kg || kg <= 0) { toast.error('Informe um valor válido'); return; }
            if (kg > availableKg) { toast.error(`Máximo disponível: ${availableKg} kg`); return; }
        }
        setShowConfirm(true);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setShowConfirm(false);
        const now = new Date().toISOString();
        const isFull = consumptionType === 'full';
        const kg = isFull ? availableKg : parseFloat(partialKg);
        const remaining = availableKg - kg;

        // Register consumption
        await base44.entities.MachineConsumption.create({
            machine_id: selectedMachine.id,
            machine_code: selectedMachine.code,
            bag_id: selectedBag.id,
            bag_number: selectedBag.bag_number,
            product_id: selectedBag.product_id,
            product_name: selectedBag.product_name,
            batch_code: selectedBag.batch_code,
            consumed_kg: kg,
            full_consumption: isFull,
            operator_id: user?.id,
            operator_name: user?.full_name,
            timestamp: now,
            notes
        });

        // Update bag
        await base44.entities.ProductionBag.update(selectedBag.id, {
            status: isFull ? 'consumed' : 'reserved',
            remaining_kg: isFull ? 0 : remaining,
            ...(isFull ? { location_code: 'CONSUMED' } : {})
        });

        // Stock movement
        await base44.entities.StockMovement.create({
            product_id: selectedBag.product_id,
            product_name: selectedBag.product_name,
            batch_code: selectedBag.batch_code,
            bag_id: selectedBag.id,
            location_code: 'FÁBRICA',
            movement_type: 'machine_consumption',
            total_kg: -kg,
            operator_id: user?.id,
            operator_name: user?.full_name,
            timestamp: now,
            notes: `Máquina: ${selectedMachine.code}`
        });

        queryClient.invalidateQueries(['consumption-bags-fabrica']);
        queryClient.invalidateQueries(['factory-bags']);
        toast.success(`${kg.toFixed(2)} kg consumidos na ${selectedMachine.code}`);

        // Reset to step 2 (same machine)
        setSelectedBag(null);
        setConsumptionType('full');
        setPartialKg('');
        setNotes('');
        setStep(2);
        setSubmitting(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 md:p-6">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link to={createPageUrl('FactoryDashboard')}>
                        <Button variant="ghost" size="icon" className="text-slate-300 hover:bg-slate-700">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white">Consumo de Máquina</h1>
                        <p className="text-slate-400 text-sm">
                            {step === 1 ? 'Passo 1 — Selecione a máquina' : step === 2 ? `Passo 2 — ${selectedMachine?.code} • Selecione a sacola` : `Passo 3 — Informe o consumo`}
                        </p>
                    </div>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2">
                    {[1, 2, 3].map(s => (
                        <React.Fragment key={s}>
                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                                step >= s ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400"
                            )}>
                                {s}
                            </div>
                            {s < 3 && <div className={cn("flex-1 h-1 rounded", step > s ? "bg-blue-600" : "bg-slate-700")} />}
                        </React.Fragment>
                    ))}
                </div>

                {/* Step 1: Select Machine */}
                {step === 1 && (
                    <Card className="bg-slate-700 border-slate-600">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Factory className="w-5 h-5 text-blue-400" /> Selecionar Máquina
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {machines.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => { setSelectedMachine(m); setStep(2); }}
                                        className="text-left p-5 rounded-xl border-2 border-slate-500 bg-slate-600 hover:border-blue-500 hover:bg-slate-600/80 transition-all active:scale-[0.98]"
                                    >
                                        <p className="text-white font-bold text-xl">{m.code}</p>
                                        <p className="text-slate-300 text-sm mt-1">{m.name}</p>
                                        <Badge className={cn("mt-2 text-xs",
                                            m.status === 'in_production' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-500 text-slate-300'
                                        )}>
                                            {m.status === 'in_production' ? 'Em Produção' : m.status}
                                        </Badge>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2: Select Bag */}
                {step === 2 && (
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                value={searchBag}
                                onChange={e => setSearchBag(e.target.value)}
                                placeholder="Buscar sacola por lote, produto..."
                                className="pl-9 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 h-12 text-base"
                            />
                        </div>

                        {filteredBags.length === 0 ? (
                            <Card className="bg-slate-700 border-slate-600">
                                <CardContent className="p-12 text-center">
                                    <Package className="w-16 h-16 mx-auto mb-4 text-slate-500" />
                                    <p className="text-slate-400 text-lg">Nenhuma sacola disponível na FÁBRICA</p>
                                    <Link to={createPageUrl('BagTransfer')} className="mt-4 inline-block">
                                        <Button className="bg-blue-600 hover:bg-blue-700 mt-4">Realizar Transferência</Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {filteredBags.map(bag => {
                                    const kg = bag.remaining_kg ?? bag.weight_kg ?? 0;
                                    const statusCfg = BAG_STATUS[bag.status] || BAG_STATUS.stored;
                                    return (
                                        <button
                                            key={bag.id}
                                            onClick={() => { setSelectedBag(bag); setStep(3); }}
                                            className="w-full text-left p-5 rounded-xl border-2 border-slate-600 bg-slate-700 hover:border-blue-500 transition-all active:scale-[0.98]"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-white font-bold text-lg font-mono">Sacola #{bag.bag_number}</p>
                                                    <p className="text-slate-300">{bag.product_name || '—'}</p>
                                                    <p className="text-slate-400 text-xs mt-1 font-mono">{bag.batch_code}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-emerald-400 font-bold text-2xl">{kg.toFixed(1)}</p>
                                                    <p className="text-slate-400 text-sm">kg disponíveis</p>
                                                    <Badge className={`mt-1 text-xs ${statusCfg.color}`}>{statusCfg.label}</Badge>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <Button variant="outline" onClick={() => setStep(1)} className="w-full border-slate-600 text-slate-300 hover:bg-slate-700">
                            ← Voltar: Trocar Máquina
                        </Button>
                    </div>
                )}

                {/* Step 3: Enter consumption */}
                {step === 3 && selectedBag && (
                    <div className="space-y-4">
                        {/* Bag info */}
                        <Card className="bg-slate-700 border-slate-600">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-slate-400 text-xs">Sacola selecionada</p>
                                        <p className="text-white font-bold text-xl font-mono">#{selectedBag.bag_number}</p>
                                        <p className="text-slate-300">{selectedBag.product_name}</p>
                                        <p className="text-slate-400 text-xs font-mono">{selectedBag.batch_code}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-emerald-400 font-bold text-3xl">{availableKg.toFixed(1)}</p>
                                        <p className="text-slate-400 text-sm">kg disponíveis</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Consumption type */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setConsumptionType('full')}
                                className={cn(
                                    "p-5 rounded-xl border-2 transition-all",
                                    consumptionType === 'full'
                                        ? "border-emerald-500 bg-emerald-900/40"
                                        : "border-slate-600 bg-slate-700 hover:border-slate-500"
                                )}
                            >
                                <CheckCircle2 className={cn("w-8 h-8 mx-auto mb-2", consumptionType === 'full' ? "text-emerald-400" : "text-slate-500")} />
                                <p className="text-white font-bold text-center">Sacola Inteira</p>
                                <p className="text-slate-400 text-sm text-center">{availableKg.toFixed(1)} kg</p>
                            </button>

                            <button
                                onClick={() => setConsumptionType('partial')}
                                className={cn(
                                    "p-5 rounded-xl border-2 transition-all",
                                    consumptionType === 'partial'
                                        ? "border-amber-500 bg-amber-900/40"
                                        : "border-slate-600 bg-slate-700 hover:border-slate-500"
                                )}
                            >
                                <Scale className={cn("w-8 h-8 mx-auto mb-2", consumptionType === 'partial' ? "text-amber-400" : "text-slate-500")} />
                                <p className="text-white font-bold text-center">Parcial</p>
                                <p className="text-slate-400 text-sm text-center">Informar peso</p>
                            </button>
                        </div>

                        {consumptionType === 'partial' && (
                            <Card className="bg-slate-700 border-slate-600">
                                <CardContent className="p-4 space-y-3">
                                    <Label className="text-slate-300">Peso consumido (kg)</Label>
                                    <Input
                                        type="number"
                                        value={partialKg}
                                        onChange={e => setPartialKg(e.target.value)}
                                        placeholder="0.0"
                                        min="0.1"
                                        max={availableKg}
                                        step="0.1"
                                        className="bg-slate-600 border-slate-500 text-white text-xl h-14 text-center"
                                    />
                                    {partialKg && (
                                        <p className="text-slate-400 text-sm text-center">
                                            Restante na sacola: {Math.max(0, availableKg - parseFloat(partialKg || 0)).toFixed(2)} kg
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        <Card className="bg-slate-700 border-slate-600">
                            <CardContent className="p-4 space-y-2">
                                <Label className="text-slate-300">Observações (opcional)</Label>
                                <Input
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Observações..."
                                    className="bg-slate-600 border-slate-500 text-white"
                                />
                            </CardContent>
                        </Card>

                        <Button
                            onClick={handleConfirmConsumption}
                            disabled={submitting}
                            className="w-full h-16 text-xl font-bold bg-emerald-600 hover:bg-emerald-700"
                        >
                            Registrar Consumo — {consumedKg.toFixed(1)} kg
                        </Button>

                        <Button variant="outline" onClick={() => setStep(2)} className="w-full border-slate-600 text-slate-300 hover:bg-slate-700">
                            ← Voltar: Trocar Sacola
                        </Button>
                    </div>
                )}
            </div>

            {/* Confirm dialog */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent className="bg-slate-800 border-slate-700">
                    <DialogHeader>
                        <DialogTitle className="text-white">Confirmar Consumo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2 text-slate-300">
                        <div className="flex justify-between"><span>Máquina:</span><span className="font-bold text-white">{selectedMachine?.code}</span></div>
                        <div className="flex justify-between"><span>Sacola:</span><span className="font-bold text-white">#{selectedBag?.bag_number}</span></div>
                        <div className="flex justify-between"><span>Lote:</span><span className="font-mono text-white">{selectedBag?.batch_code}</span></div>
                        <div className="flex justify-between"><span>Consumo:</span><span className="font-bold text-emerald-400 text-lg">{consumedKg.toFixed(2)} kg</span></div>
                        <div className="flex justify-between"><span>Tipo:</span><span className={consumptionType === 'full' ? 'text-emerald-400' : 'text-amber-400'}>{consumptionType === 'full' ? 'Sacola inteira' : 'Parcial'}</span></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowConfirm(false)} className="border-slate-600 text-slate-300">Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                            {submitting ? 'Salvando...' : 'Confirmar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}