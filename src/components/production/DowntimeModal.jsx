import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Clock, Wrench, Settings, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const categoryConfig = {
    planned: { label: 'Planejada', icon: Clock, color: 'bg-blue-100 text-blue-700 border-blue-200' },
    unplanned: { label: 'Não Planejada', icon: AlertTriangle, color: 'bg-red-100 text-red-700 border-red-200' },
    maintenance: { label: 'Manutenção', icon: Wrench, color: 'bg-amber-100 text-amber-700 border-amber-200' },
    setup: { label: 'Setup', icon: Settings, color: 'bg-purple-100 text-purple-700 border-purple-200' },
    quality: { label: 'Qualidade', icon: AlertCircle, color: 'bg-orange-100 text-orange-700 border-orange-200' }
};

export default function DowntimeModal({
    open,
    onClose,
    onConfirm,
    reasons = [],
    isClosing = false,
    currentDowntime = null
}) {
    const [selectedReason, setSelectedReason] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        if (!isClosing && !selectedReason) return;

        setIsSubmitting(true);
        try {
            await onConfirm(selectedReason);
            setSelectedReason(null);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setSelectedReason(null);
        onClose();
    };

    const groupedReasons = reasons.reduce((acc, reason) => {
        const cat = reason.category || 'other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(reason);
        return acc;
    }, {});

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center",
                            isClosing ? "bg-emerald-100" : "bg-red-100"
                        )}>
                            {isClosing ? (
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            )}
                        </div>
                        {isClosing ? 'Encerrar Parada' : 'Registrar Parada'}
                    </DialogTitle>
                </DialogHeader>

                {isClosing && currentDowntime ? (
                    <div className="py-6">
                        <div className="bg-slate-50 rounded-xl p-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600">Motivo</span>
                                <span className="font-semibold">{currentDowntime.reason_name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600">Início</span>
                                <span className="font-semibold">
                                    {new Date(currentDowntime.start_time).toLocaleTimeString('pt-BR')}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600">Duração</span>
                                <span className="font-semibold text-red-600">
                                    {Math.round((Date.now() - new Date(currentDowntime.start_time).getTime()) / 60000)} min
                                </span>
                            </div>
                        </div>
                        <p className="text-center text-slate-600 mt-4">
                            Confirma o encerramento desta parada?
                        </p>
                    </div>
                ) : (
                    <ScrollArea className="max-h-[50vh] pr-4">
                        <div className="space-y-4 py-2">
                            {Object.entries(groupedReasons).map(([category, categoryReasons]) => {
                                const config = categoryConfig[category] || categoryConfig.planned;
                                const Icon = config.icon;

                                return (
                                    <div key={category}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Icon className="w-4 h-4 text-slate-500" />
                                            <span className="text-sm font-medium text-slate-700">{config.label}</span>
                                        </div>
                                        <div className="grid gap-2">
                                            {categoryReasons.map((reason) => (
                                                <button
                                                    key={reason.id}
                                                    onClick={() => setSelectedReason(reason)}
                                                    className={cn(
                                                        "w-full text-left p-4 rounded-xl border-2 transition-all",
                                                        "hover:shadow-md active:scale-[0.98]",
                                                        selectedReason?.id === reason.id
                                                            ? "border-blue-500 bg-blue-50"
                                                            : "border-slate-200 bg-white hover:border-slate-300"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-semibold text-slate-900">{reason.name}</p>
                                                            {reason.description && (
                                                                <p className="text-sm text-slate-500 mt-1">{reason.description}</p>
                                                            )}
                                                        </div>
                                                        <div className={cn(
                                                            "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                                            selectedReason?.id === reason.id
                                                                ? "border-blue-500 bg-blue-500"
                                                                : "border-slate-300"
                                                        )}>
                                                            {selectedReason?.id === reason.id && (
                                                                <CheckCircle className="w-3 h-3 text-white" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}

                <DialogFooter className="gap-3">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        className="flex-1 h-12"
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={(!isClosing && !selectedReason) || isSubmitting}
                        className={cn(
                            "flex-1 h-12 font-semibold",
                            isClosing
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : "bg-red-600 hover:bg-red-700"
                        )}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Processando...
                            </span>
                        ) : (
                            isClosing ? 'Encerrar Parada' : 'Confirmar Parada'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}