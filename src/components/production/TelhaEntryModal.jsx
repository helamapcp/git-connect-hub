import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Scale, CheckCircle, Package } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TelhaEntryModal({
    open, onClose, onConfirm,
    lotes = [],
    lastWeightSample = null,
    weightSampleRequired = false
}) {
    const [form, setForm] = useState({
        quantidade_un: '',
        refugo_processo_kg: '',
        refugo_telha_un: '',
        tipo_b_un: '',
        capstock_consumo_kg: '',
        peso_medio_amostrado: '',
        lote_id: ''
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [refugoKgCalc, setRefugoKgCalc] = useState(0);

    const peso_medio = parseFloat(form.peso_medio_amostrado) || (lastWeightSample?.peso_medio ?? 0);

    useEffect(() => {
        const telhaUn = parseFloat(form.refugo_telha_un) || 0;
        setRefugoKgCalc(+(peso_medio * telhaUn).toFixed(3));
    }, [form.refugo_telha_un, form.peso_medio_amostrado, lastWeightSample]);

    const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

    // Validações mínimas – NENHUM campo é obrigatório exceto ter algo preenchido
    const validate = () => {
        const e = {};
        const qty = parseFloat(form.quantidade_un);
        const refugoProc = parseFloat(form.refugo_processo_kg) || 0;
        const refugoTelha = parseFloat(form.refugo_telha_un) || 0;
        const tipoB = parseFloat(form.tipo_b_un) || 0;
        const capstock = parseFloat(form.capstock_consumo_kg) || 0;

        if (qty !== '' && qty < 0) e.quantidade_un = 'Deve ser >= 0';
        if (refugoProc < 0) e.refugo_processo_kg = 'Deve ser >= 0';
        if (refugoTelha < 0) e.refugo_telha_un = 'Deve ser >= 0';
        if (tipoB < 0) e.tipo_b_un = 'Deve ser >= 0';
        if (capstock < 0) e.capstock_consumo_kg = 'Deve ser >= 0';
        // Só valida refugo telha+tipoB vs produção se produção foi informada
        if (qty > 0 && (refugoTelha + tipoB) > qty) e.refugo_telha_un = 'Refugo Telha + Tipo B não pode exceder produção';
        // Refugo telha precisa de peso médio para calcular
        if (refugoTelha > 0 && !peso_medio) e.peso_medio_amostrado = 'Necessário para calcular refugo telha';
        // Lote só obrigatório se capstock foi informado
        if (capstock > 0 && !form.lote_id) e.lote_id = 'Informe o lote ao consumir capstock';

        const temAlgo = qty > 0 || refugoProc > 0 || refugoTelha > 0 || tipoB > 0 || capstock > 0 || form.peso_medio_amostrado;
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
                quantity: parseFloat(form.quantidade_un) || 0,
                refugo_processo_kg: parseFloat(form.refugo_processo_kg) || 0,
                refugo_telha_un: parseFloat(form.refugo_telha_un) || 0,
                refugo_telha_kg_calculado: refugoKgCalc,
                tipo_b_un: parseFloat(form.tipo_b_un) || 0,
                capstock_consumo_kg: parseFloat(form.capstock_consumo_kg) || 0,
                peso_medio_amostrado: parseFloat(form.peso_medio_amostrado) || peso_medio || undefined,
                lote_id: form.lote_id || undefined,
                lote_codigo: lote?.codigo_lote,
                categoria_processo: 'TELHA'
            });
            setForm({ quantidade_un: '', refugo_processo_kg: '', refugo_telha_un: '', tipo_b_un: '', capstock_consumo_kg: '', peso_medio_amostrado: '', lote_id: '' });
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const loteSelecionado = lotes.find(l => l.id === form.lote_id);
    const loteQuaseFim = loteSelecionado && (loteSelecionado.peso_disponivel / loteSelecionado.peso_inicial) < 0.1;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Package className="w-6 h-6 text-blue-600" />
                        Apontamento – TELHA
                    </DialogTitle>
                </DialogHeader>

                {weightSampleRequired && (
                    <Alert className="border-amber-300 bg-amber-50">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <AlertDescription className="text-amber-700">
                            Intervalo de 30 min sem peso médio — recomendado informar abaixo.
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
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label>Produção (UN)</Label>
                            <Input type="number" min="0" placeholder="0" value={form.quantidade_un}
                                onChange={e => set('quantidade_un', e.target.value)}
                                className={cn(errors.quantidade_un && "border-red-500")} />
                            {errors.quantidade_un && <p className="text-xs text-red-600">{errors.quantidade_un}</p>}
                        </div>
                        <div className="space-y-1">
                            <Label>Capstock (KG)</Label>
                            <Input type="number" min="0" step="0.01" placeholder="0.000" value={form.capstock_consumo_kg}
                                onChange={e => set('capstock_consumo_kg', e.target.value)}
                                className={cn(errors.capstock_consumo_kg && "border-red-500")} />
                            {errors.capstock_consumo_kg && <p className="text-xs text-red-600">{errors.capstock_consumo_kg}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <Label>Refugo Proc. (KG)</Label>
                            <Input type="number" min="0" step="0.01" placeholder="0.000" value={form.refugo_processo_kg}
                                onChange={e => set('refugo_processo_kg', e.target.value)}
                                className={cn(errors.refugo_processo_kg && "border-red-500")} />
                        </div>
                        <div className="space-y-1">
                            <Label>Refugo Telha (UN)</Label>
                            <Input type="number" min="0" placeholder="0" value={form.refugo_telha_un}
                                onChange={e => set('refugo_telha_un', e.target.value)}
                                className={cn(errors.refugo_telha_un && "border-red-500")} />
                            {errors.refugo_telha_un && <p className="text-xs text-red-600">{errors.refugo_telha_un}</p>}
                        </div>
                        <div className="space-y-1">
                            <Label>Tipo B (UN)</Label>
                            <Input type="number" min="0" placeholder="0" value={form.tipo_b_un}
                                onChange={e => set('tipo_b_un', e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label className="flex items-center gap-2">
                            <Scale className="w-4 h-4" />
                            Peso Médio Amostrado (KG)
                            {lastWeightSample && (
                                <span className="text-xs text-slate-500 font-normal">— último: {lastWeightSample.peso_medio} kg</span>
                            )}
                        </Label>
                        <Input type="number" min="0" step="0.001"
                            placeholder={lastWeightSample?.peso_medio?.toString() || "0.000"}
                            value={form.peso_medio_amostrado}
                            onChange={e => set('peso_medio_amostrado', e.target.value)}
                            className={cn(errors.peso_medio_amostrado && "border-red-500")} />
                        {errors.peso_medio_amostrado && <p className="text-xs text-red-600">{errors.peso_medio_amostrado}</p>}
                    </div>

                    {(parseFloat(form.refugo_telha_un) > 0 && refugoKgCalc > 0) && (
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                            <p className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />Cálculo automático de refugo telha
                            </p>
                            <div className="flex items-center gap-2 text-sm text-blue-700">
                                <span>{form.refugo_telha_un} UN</span><span>×</span>
                                <span>{peso_medio.toFixed(3)} kg/un</span><span>=</span>
                                <span className="font-bold text-lg">{refugoKgCalc} kg</span>
                            </div>
                        </div>
                    )}

                    <div className="space-y-1">
                        <Label>Lote de Composto {parseFloat(form.capstock_consumo_kg) > 0 ? '*' : '(opcional)'}</Label>
                        <Select value={form.lote_id} onValueChange={v => set('lote_id', v)}>
                            <SelectTrigger className={cn(errors.lote_id && "border-red-500")}>
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
                        {errors.lote_id && <p className="text-xs text-red-600">{errors.lote_id}</p>}
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
                    <Button onClick={handleConfirm} disabled={isSubmitting} className="flex-1 h-12 font-semibold bg-blue-600 hover:bg-blue-700">
                        {isSubmitting ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Salvando...</span> : 'Confirmar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}