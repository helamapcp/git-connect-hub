import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Package, Target, TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const statusConfig = {
    pending: { label: 'Pendente', color: 'bg-slate-100 text-slate-700' },
    in_progress: { label: 'Em Produção', color: 'bg-blue-100 text-blue-700' },
    paused: { label: 'Pausada', color: 'bg-amber-100 text-amber-700' },
    completed: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700' }
};

const priorityConfig = {
    low: { label: 'Baixa', color: 'bg-slate-100 text-slate-600' },
    normal: { label: 'Normal', color: 'bg-blue-100 text-blue-600' },
    high: { label: 'Alta', color: 'bg-amber-100 text-amber-600' },
    urgent: { label: 'Urgente', color: 'bg-red-100 text-red-600' }
};

export default function OrderStatusPanel({ order, session }) {
    if (!order) {
        return (
            <Card className="border-2 border-dashed border-slate-300 bg-slate-50">
                <CardContent className="p-8 text-center">
                    <Package className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                    <h3 className="text-lg font-semibold text-slate-600 mb-2">Nenhuma ordem selecionada</h3>
                    <p className="text-sm text-slate-500">Selecione uma ordem de produção para iniciar</p>
                </CardContent>
            </Card>
        );
    }

    const progress = order.quantity_planned > 0
        ? Math.min(100, (order.quantity_produced / order.quantity_planned) * 100)
        : 0;

    const efficiency = session?.total_produced > 0 && session?.total_loss > 0
        ? ((session.total_produced - session.total_loss) / session.total_produced * 100).toFixed(1)
        : 100;

    const status = statusConfig[order.status] || statusConfig.pending;
    const priority = priorityConfig[order.priority] || priorityConfig.normal;

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-xl font-bold text-slate-900">
                            {order.order_number}
                        </CardTitle>
                        <p className="text-sm text-slate-600 mt-1">{order.product_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{order.product_code}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <Badge className={status.color}>{status.label}</Badge>
                        <Badge variant="outline" className={priority.color}>{priority.label}</Badge>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Progresso</span>
                        <span className="font-semibold text-slate-900">
                            {order.quantity_produced?.toFixed(1)} / {order.quantity_planned} {order.unit}
                        </span>
                    </div>
                    <Progress value={progress} className="h-3" />
                    <p className="text-xs text-right text-slate-500">{progress.toFixed(1)}% concluído</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                        <Target className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                        <p className="text-xs text-slate-500 mb-1">Meta</p>
                        <p className="font-bold text-lg text-slate-900">{order.quantity_planned}</p>
                    </div>

                    <div className="bg-emerald-50 rounded-xl p-4 text-center">
                        <TrendingUp className="w-5 h-5 mx-auto mb-2 text-emerald-500" />
                        <p className="text-xs text-slate-500 mb-1">Produzido</p>
                        <p className="font-bold text-lg text-emerald-700">{order.quantity_produced?.toFixed(1) || 0}</p>
                    </div>

                    <div className="bg-red-50 rounded-xl p-4 text-center">
                        <AlertCircle className="w-5 h-5 mx-auto mb-2 text-red-500" />
                        <p className="text-xs text-slate-500 mb-1">Refugo</p>
                        <p className="font-bold text-lg text-red-700">{order.quantity_loss?.toFixed(1) || 0}</p>
                    </div>
                </div>

                {session && (
                    <div className="pt-4 border-t border-slate-200">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Eficiência da sessão</span>
                            <span className={cn(
                                "font-bold text-lg",
                                parseFloat(efficiency) >= 90 ? "text-emerald-600" :
                                    parseFloat(efficiency) >= 70 ? "text-amber-600" : "text-red-600"
                            )}>
                                {efficiency}%
                            </span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}