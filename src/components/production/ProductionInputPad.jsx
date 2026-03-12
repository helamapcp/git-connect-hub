import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus, Check, Delete } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProductionInputPad({
    onSubmit,
    unit = 'metros',
    disabled = false,
    quickValues = [1, 5, 10, 25, 50, 100]
}) {
    const [value, setValue] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleNumberClick = (num) => {
        if (value.length < 8) {
            setValue(prev => prev + num);
        }
    };

    const handleDecimal = () => {
        if (!value.includes('.')) {
            setValue(prev => prev === '' ? '0.' : prev + '.');
        }
    };

    const handleClear = () => setValue('');

    const handleBackspace = () => setValue(prev => prev.slice(0, -1));

    const handleQuickValue = (quickVal) => {
        setValue(String(quickVal));
    };

    const handleSubmit = async () => {
        const numValue = parseFloat(value);
        if (!numValue || numValue <= 0 || isSubmitting) return;

        setIsSubmitting(true);
        try {
            await onSubmit(numValue);
            setValue('');
        } finally {
            setIsSubmitting(false);
        }
    };

    const numpadButtons = [
        '7', '8', '9',
        '4', '5', '6',
        '1', '2', '3',
        '.', '0', 'back'
    ];

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-slate-900">
                    Apontar Produção
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Display */}
                <div className="relative">
                    <Input
                        type="text"
                        value={value}
                        readOnly
                        placeholder="0"
                        className="text-right text-3xl font-bold h-16 pr-16 bg-slate-50 border-slate-200"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">
                        {unit}
                    </span>
                </div>

                {/* Quick Values */}
                <div className="grid grid-cols-6 gap-2">
                    {quickValues.map(qv => (
                        <Button
                            key={qv}
                            variant="outline"
                            size="sm"
                            className="h-11 text-sm font-medium"
                            onClick={() => handleQuickValue(qv)}
                            disabled={disabled}
                        >
                            +{qv}
                        </Button>
                    ))}
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-2">
                    {numpadButtons.map((btn) => (
                        <Button
                            key={btn}
                            variant={btn === 'back' ? 'outline' : 'secondary'}
                            className={cn(
                                "h-14 text-xl font-semibold",
                                btn === 'back' && "bg-slate-100"
                            )}
                            onClick={() => {
                                if (btn === 'back') handleBackspace();
                                else if (btn === '.') handleDecimal();
                                else handleNumberClick(btn);
                            }}
                            disabled={disabled}
                        >
                            {btn === 'back' ? <Delete className="w-5 h-5" /> : btn}
                        </Button>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button
                        variant="outline"
                        size="lg"
                        className="h-14 text-base"
                        onClick={handleClear}
                        disabled={disabled || !value}
                    >
                        Limpar
                    </Button>
                    <Button
                        size="lg"
                        className={cn(
                            "h-14 text-base font-semibold",
                            "bg-emerald-600 hover:bg-emerald-700"
                        )}
                        onClick={handleSubmit}
                        disabled={disabled || !value || parseFloat(value) <= 0 || isSubmitting}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Salvando...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Check className="w-5 h-5" />
                                Confirmar
                            </span>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}