import React from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RotateCcw, ArrowRightCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Modal usado em 2 situações:
// mode="interrupt" → confirmar interrupção de OP_PADRAO para OP_PEDIDO
// mode="resume"    → sugestão de retomada de OP_PADRAO após finalizar OP_PEDIDO

export default function PedidoInterruptModal({
    open, onClose, mode = 'interrupt',
    currentOrder = null,   // OP_PADRAO em produção (ao interromper) ou pausada (ao retomar)
    pedidoOrder = null,    // OP_PEDIDO que causou / foi finalizada
    onConfirm, onSkip
}) {
    if (mode === 'interrupt') {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-amber-700">
                            <AlertTriangle className="w-6 h-6" />
                            Interromper OP Padrão
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4 space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <p className="text-sm text-amber-700 mb-3">Existe uma OP Padrão em produção:</p>
                            <div className="font-bold text-slate-900">{currentOrder?.order_number}</div>
                            <div className="text-sm text-slate-600">{currentOrder?.product_name}</div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-sm text-blue-700 mb-3">Nova OP de Pedido a iniciar:</p>
                            <div className="font-bold text-slate-900">{pedidoOrder?.order_number}</div>
                            <div className="text-sm text-slate-600">{pedidoOrder?.product_name}</div>
                            <Badge className="mt-2 bg-blue-100 text-blue-700">PEDIDO</Badge>
                        </div>

                        <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                            A OP Padrão será <strong>pausada</strong> e poderá ser retomada após a conclusão do pedido.
                        </p>
                    </div>

                    <DialogFooter className="gap-3">
                        <Button variant="outline" onClick={onClose} className="flex-1 h-12">
                            Cancelar
                        </Button>
                        <Button onClick={onConfirm} className="flex-1 h-12 bg-amber-600 hover:bg-amber-700 font-semibold">
                            <ArrowRightCircle className="w-5 h-5 mr-2" />
                            Pausar e Iniciar Pedido
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // mode === 'resume'
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-emerald-700">
                        <RotateCcw className="w-6 h-6" />
                        Retomar OP Padrão?
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <p className="text-slate-600">A OP de pedido foi finalizada. Deseja retomar a OP Padrão pausada?</p>

                    {currentOrder && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                            <Badge className="mb-2 bg-slate-100 text-slate-600">PADRÃO</Badge>
                            <div className="font-bold text-slate-900">{currentOrder?.order_number}</div>
                            <div className="text-sm text-slate-600">{currentOrder?.product_name}</div>
                            <div className="text-xs text-slate-500 mt-1">
                                Produzido: {currentOrder?.quantity_produced} / {currentOrder?.quantity_planned} {currentOrder?.unit}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-3">
                    <Button variant="outline" onClick={onSkip} className="flex-1 h-12">
                        Não retomar agora
                    </Button>
                    <Button onClick={onConfirm} className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 font-semibold">
                        <RotateCcw className="w-5 h-5 mr-2" />
                        Retomar OP Padrão
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}