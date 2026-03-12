import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Package, Wrench, AlertCircle, User, CheckCircle, Delete } from "lucide-react";
import { cn } from "@/lib/utils";

const categoryConfig = {
    material: { label: 'Material', icon: Package, color: 'bg-amber-100 text-amber-700' },
    process: { label: 'Processo', icon: AlertCircle, color: 'bg-red-100 text-red-700' },
    equipment: { label: 'Equipamento', icon: Wrench, color: 'bg-blue-100 text-blue-700' },
    operator: { label: 'Operador', icon: User, color: 'bg-purple-100 text-purple-700' },
    quality: { label: 'Qualidade', icon: AlertCircle, color: 'bg-orange-100 text-orange-700' }
};

export default function LossModal({
    open,
    onClose,
    onConfirm,
    reasons = [],
    unit = 'metros'
}) {
    const [selectedReason, setSelectedReason] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        const numValue = parseFloat(quantity);
        if (!selectedReason || !numValue || numValue <= 0) return;

        setIsSubmitting(true);
        try {
            await onConfirm(selectedReason, numValue);
            setSelectedReason(null);
            setQuantity('');
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setSelectedReason(null);
        setQuantity('');
        onClose();
    };

    const handleNumberClick = (num) => {
        if (quantity.length < 6) {
            setQuantity(prev => prev + num);
        }
    };

    const handleDecimal = () => {
        if (!quantity.includes('.')) {
            setQuantity(prev => prev === '' ? '0.' : prev + '.');
        }
    };

    const groupedReasons = reasons.reduce((acc, reason) => {
        const cat = reason.category || 'other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(reason);
        return acc;
    }, {});

    const quickValues = [0.5, 1, 2, 5, 10];

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                            <Trash2 className="w-5 h-5 text-red-600" />
                        </div>
                        Registrar Refugo
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Quantity Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Quantidade</label>
                        <div className="relative">
                            <Input
                                type="text"
                                value={quantity}
                                readOnly
                                placeholder="0"
                                className="text-right text-2xl font-bold h-14 pr-16 bg-slate-50"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                                {unit}
                            </span>
                        </div>

                        {/* Quick Values */}
                        <div className="grid grid-cols-5 gap-2">
                            {quickValues.map(qv => (
                                <Button
                                    key={qv}
                                    variant="outline"
                                    size="sm"
                                    className="h-10"
                                    onClick={() => setQuantity(String(qv))}
                                >
                                    {qv}
                                </Button>
                            ))}
                        </div>

                        {/* Mini Numpad */}
                        <div className="grid grid-cols-4 gap-1">
                            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((btn) => (
                                <Button
                                    key={btn}
                                    variant="secondary"
                                    size="sm"
                                    className="h-10 text-lg"
                                    onClick={() => btn === '.' ? handleDecimal() : handleNumberClick(btn)}
                                >
                                    {btn}
                                </Button>
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-10"
                                onClick={() => setQuantity(prev => prev.slice(0, -1))}
                            >
                                <Delete className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Reason Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Motivo do Refugo</label>
                        <ScrollArea className="h-48 pr-4">
                            <div className="space-y-3">
                                {Object.entries(groupedReasons).map(([category, categoryReasons]) => {
                                    const config = categoryConfig[category] || categoryConfig.material;
                                    const Icon = config.icon;

                                    return (
                                        <div key={category}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Icon className="w-3 h-3 text-slate-500" />
                                                <span className="text-xs font-medium text-slate-500">{config.label}</span>
                                            </div>
                                            <div className="grid gap-1">
                                                {categoryReasons.map((reason) => (
                                                    <button
                                                        key={reason.id}
                                                        onClick={() => setSelectedReason(reason)}
                                                        className={cn(
                                                            "w-full text-left p-3 rounded-lg border transition-all",
                                                            "hover:shadow-sm active:scale-[0.99]",
                                                            selectedReason?.id === reason.id
                                                                ? "border-red-500 bg-red-50"
                                                                : "border-slate-200 bg-white hover:border-slate-300"
                                                        )}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-medium text-sm text-slate-900">{reason.name}</span>
                                                            {selectedReason?.id === reason.id && (
                                                                <CheckCircle className="w-4 h-4 text-red-500" />
                                                            )}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter className="gap-3 mt-4">
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
                        disabled={!selectedReason || !quantity || parseFloat(quantity) <= 0 || isSubmitting}
                        className="flex-1 h-12 font-semibold bg-red-600 hover:bg-red-700"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Salvando...
                            </span>
                        ) : (
                            'Confirmar Refugo'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}