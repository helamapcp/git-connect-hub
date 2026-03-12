import React, { useState } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ForroEntryModal({
    open, onClose, onConfirm,
    lotes = [],
    categoria = 'FORRO',
    lastWeightSample = null,
    weightSampleRequired = false
}) {
    const [form, setForm] = useState({
        quantidade_caixas: '',
        refugo_kg: '',
        peso_medio_amostrado: '',
        lote_id: ''
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

    const validate = () => {
        const e = {};
        const qty = parseFloat(form.quantidade_caixas) || 0;
        const refugo = parseFloat(form.refugo_kg) || 0;
        const capstock = 0; // FORRO não tem capstock separado
        if (qty < 0) e.quantidade_caixas = 'Deve ser >= 0';
        if (refugo < 0) e.refugo_kg = 'Deve ser >= 0';

        const temAlgo = qty > 0 || refugo > 0 || form.peso_medio_amostrado || form.lote_id;
        if (!temAlgo) e._geral = 'Informe pelo menos um valor';

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleConfirm = async () => {
        if (!validate()) return;
        setIsSubmitting(true);
        try {
            const lote = lotes.find(l => l.id === form.lote_id);
            await onConfirm({
                quantity: parseFloat(form.quantidade_caixas) || 0,
                refugo_processo_kg: parseFloat(form.refugo_kg) || 0,
                peso_medio_amostrado: parseFloat(form.peso_medio_amostrado) || undefined,
                lote_id: form.lote_id || undefined,
                lote_codigo: lote?.codigo_lote,
                categoria_processo: categoria
            });
            setForm({ quantidade_caixas: '', refugo_kg: '', peso_medio_amostrado: '', lote_id: '' });
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const loteSelecionado = lotes.find(l => l.id === form.lote_id);
    const loteQuaseFim = loteSelecionado && (loteSelecionado.peso_disponivel / loteSelecionado.peso_inicial) < 0.1;
    const categoryLabel = { FORRO: 'FORRO', ACABAMENTO: 'ACABAMENTO', CUMEEIRA: 'CUMEEIRA', PORTA: 'PORTA' }[categoria] || categoria;
    const unidadeProducao = ['FORRO', 'ACABAMENTO'].includes(categoria) ? 'CAIXAS' : 'UNIDADES';

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Package className="w-6 h-6 text-emerald-600" />
                        Apontamento – {categoryLabel}
                    </DialogTitle>
                </DialogHeader>

                {weightSampleRequired && (
                    <Alert className="border-amber-300 bg-amber-50">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <AlertDescription className="text-amber-700">
                            Intervalo de 1 hora sem peso médio — recomendado informar abaixo.
                        </AlertDescription>
                    </Alert>
                )}

                {errors._geral && (
                    <Alert className="border-red-300 bg-red-50">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <AlertDescription className="text-red-700">{errors._geral}</AlertDescription>
                    </Alert>
                )}

                <div className="space-y-4 py-2">
                    <div className="space-y-1">
                        <Label>Produção ({unidadeProducao})</Label>
                        <Input type="number" min="0" placeholder="0"
                            value={form.quantidade_caixas}
                            onChange={e => set('quantidade_caixas', e.target.value)}
                            className={cn("text-2xl h-14 text-right font-bold", errors.quantidade_caixas && "border-red-500")} />
                        {errors.quantidade_caixas && <p className="text-xs text-red-600">{errors.quantidade_caixas}</p>}
                    </div>

                    <div className="space-y-1">
                        <Label>Refugo (KG)</Label>
                        <Input type="number" min="0" step="0.01" placeholder="0.000"
                            value={form.refugo_kg}
                            onChange={e => set('refugo_kg', e.target.value)}
                            className={cn(errors.refugo_kg && "border-red-500")} />
                    </div>

                    {/* Peso médio por hora para FORRO */}
                    <div className="space-y-1">
                        <Label className="flex items-center gap-2">
                            <Scale className="w-4 h-4" />
                            Peso Médio Amostrado (KG/hora)
                            {lastWeightSample && (
                                <span className="text-xs text-slate-500 font-normal">— último: {lastWeightSample.peso_medio} kg</span>
                            )}
                        </Label>
                        <Input type="number" min="0" step="0.001"
                            placeholder={lastWeightSample?.peso_medio?.toString() || "0.000"}
                            value={form.peso_medio_amostrado}
                            onChange={e => set('peso_medio_amostrado', e.target.value)} />
                    </div>

                    <div className="space-y-1">
                        <Label>Lote de Composto (opcional)</Label>
                        <Select value={form.lote_id} onValueChange={v => set('lote_id', v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o lote (opcional)" />
                            </SelectTrigger>
                            <SelectContent>
                                {lotes.filter(l => l.status !== 'esgotado').map(l => (
                                    <SelectItem key={l.id} value={l.id}>
                                        <span>{l.codigo_lote}</span>
                                        <span className="text-xs text-slate-500 ml-2">({l.peso_disponivel?.toFixed(1)} kg disp.)</span>
                                        {(l.peso_disponivel / l.peso_inicial) < 0.1 && (
                                            <Badge className="bg-red-100 text-red-600 text-xs ml-1">Crítico</Badge>
                                        )}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {loteQuaseFim && (
                            <Alert className="border-red-300 bg-red-50 mt-1">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                <AlertDescription className="text-red-700 text-xs">Lote com menos de 10% disponível.</AlertDescription>
                            </Alert>
                        )}
                    </div>
                </div>

                <DialogFooter className="gap-3 mt-4">
                    <Button variant="outline" onClick={onClose} className="flex-1 h-12" disabled={isSubmitting}>Cancelar</Button>
                    <Button onClick={handleConfirm} disabled={isSubmitting} className="flex-1 h-12 font-semibold bg-emerald-600 hover:bg-emerald-700">
                        {isSubmitting ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Salvando...</span> : 'Confirmar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}