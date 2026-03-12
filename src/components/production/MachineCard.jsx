import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Play, Pause, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const statusConfig = {
    available: {
        label: 'Disponível',
        color: 'bg-emerald-500',
        bgColor: 'bg-emerald-50 border-emerald-200',
        icon: CheckCircle
    },
    in_production: {
        label: 'Em Produção',
        color: 'bg-blue-500',
        bgColor: 'bg-blue-50 border-blue-200',
        icon: Play
    },
    maintenance: {
        label: 'Manutenção',
        color: 'bg-amber-500',
        bgColor: 'bg-amber-50 border-amber-200',
        icon: Settings
    },
    inactive: {
        label: 'Inativa',
        color: 'bg-slate-400',
        bgColor: 'bg-slate-50 border-slate-200',
        icon: Pause
    }
};

const typeLabels = {
    extrusora: 'Extrusora',
    injetora: 'Injetora',
    cortadeira: 'Cortadeira',
    embaladora: 'Embaladora'
};

export default function MachineCard({ machine, onClick, selected, hasDowntime }) {
    const status = statusConfig[machine.status] || statusConfig.inactive;
    const StatusIcon = status.icon;

    return (
        <Card
            className={cn(
                "cursor-pointer transition-all duration-200 border-2 hover:shadow-lg active:scale-[0.98]",
                selected ? "ring-2 ring-blue-500 border-blue-500" : status.bgColor,
                hasDowntime && "border-red-500 bg-red-50"
            )}
            onClick={() => onClick?.(machine)}
        >
            <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center",
                            hasDowntime ? "bg-red-100" : "bg-slate-100"
                        )}>
                            {hasDowntime ? (
                                <AlertTriangle className="w-6 h-6 text-red-600" />
                            ) : (
                                <StatusIcon className={cn("w-6 h-6", status.color.replace('bg-', 'text-'))} />
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-900">{machine.code}</h3>
                            <p className="text-sm text-slate-600">{machine.name}</p>
                        </div>
                    </div>
                    <Badge
                        variant="secondary"
                        className={cn(
                            "text-xs font-medium",
                            hasDowntime ? "bg-red-100 text-red-700" : status.bgColor
                        )}
                    >
                        {hasDowntime ? 'Parada' : status.label}
                    </Badge>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                    <span className="text-sm text-slate-500">{typeLabels[machine.type]}</span>
                    <span className="text-sm text-slate-500">{machine.sector}</span>
                </div>
            </CardContent>
        </Card>
    );
}