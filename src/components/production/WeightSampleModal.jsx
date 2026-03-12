import React, { useState } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, Clock } from "lucide-react";
import { format } from "date-fns";

function roundTo30Min(date = new Date()) {
    const ms = 30 * 60 * 1000;
    return new Date(Math.floor(date.getTime() / ms) * ms);
}
function roundToHour(date = new Date()) {
    const d = new Date(date); d.setMinutes(0, 0, 0); return d;
}

export default function WeightSampleModal({ open, onClose, onConfirm, sessionId, machineId, userId, intervaloTipo = '30MIN', categoriaProcesso }) {
    const [pesoMedio, setPesoMedio] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const refTime = intervaloTipo === '1H' ? roundToHour() : roundTo30Min();
    const nextTime = new Date(refTime.getTime() + (intervaloTipo === '1H' ? 60 : 30) * 60 * 1000);

    const handleConfirm = async () => {
        const peso = parseFloat(pesoMedio);
        if (!peso || peso <= 0) {
            setError('Informe um peso válido > 0');
            return;
        }
        setIsSubmitting(true);
        try {
            await onConfirm({
                session_id: sessionId,
                machine_id: machineId,
                operator_id: userId,
                categoria_processo: categoriaProcesso,
                intervalo_tipo: intervaloTipo,
                peso_medio: peso,
                timestamp: new Date().toISOString(),
                timestamp_referencia: refTime.toISOString()
            });
            setPesoMedio('');
            setError('');
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Scale className="w-6 h-6 text-violet-600" />
                        Peso Médio – {intervaloTipo === '1H' ? '1 hora' : '30 min'}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="bg-violet-50 rounded-xl p-4 flex items-center gap-3">
                        <Clock className="w-5 h-5 text-violet-600" />
                        <div>
                            <p className="text-xs text-violet-600">Intervalo de referência</p>
                            <p className="font-bold text-violet-900">{format(refTime, "HH:mm")} – {format(nextTime, "HH:mm")}</p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label>Peso Médio Amostrado (KG) *</Label>
                        <Input
                            type="number"
                            min="0"
                            step="0.001"
                            placeholder="0.000"
                            value={pesoMedio}
                            onChange={e => { setPesoMedio(e.target.value); setError(''); }}
                            className="text-2xl h-14 text-center font-bold"
                            autoFocus
                        />
                        {error && <p className="text-xs text-red-600">{error}</p>}
                    </div>
                </div>

                <DialogFooter className="gap-3">
                    <Button variant="outline" onClick={onClose} className="flex-1 h-12" disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} disabled={isSubmitting} className="flex-1 h-12 bg-violet-600 hover:bg-violet-700 font-semibold">
                        {isSubmitting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Registrar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}