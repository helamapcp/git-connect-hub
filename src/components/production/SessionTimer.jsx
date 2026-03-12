import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, Pause, User, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SessionTimer({ session, hasDowntime = false }) {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!session?.start_time) return;

        const startTime = new Date(session.start_time).getTime();

        const updateElapsed = () => {
            const now = Date.now();
            setElapsed(Math.floor((now - startTime) / 1000));
        };

        updateElapsed();
        const interval = setInterval(updateElapsed, 1000);

        return () => clearInterval(interval);
    }, [session?.start_time]);

    if (!session) {
        return (
            <Card className="border-slate-200">
                <CardContent className="p-4">
                    <div className="flex items-center gap-3 text-slate-500">
                        <Clock className="w-5 h-5" />
                        <span>Nenhuma sessão ativa</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;

    const formatTime = (val) => String(val).padStart(2, '0');

    const productiveTime = elapsed - (session.total_downtime_minutes || 0) * 60;
    const productiveHours = Math.floor(productiveTime / 3600);
    const productiveMinutes = Math.floor((productiveTime % 3600) / 60);

    return (
        <Card className={cn(
            "border-2 transition-colors",
            hasDowntime ? "border-red-300 bg-red-50" : "border-emerald-200 bg-emerald-50"
        )}>
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center",
                            hasDowntime ? "bg-red-100" : "bg-emerald-100"
                        )}>
                            {hasDowntime ? (
                                <Pause className="w-6 h-6 text-red-600" />
                            ) : (
                                <Play className="w-6 h-6 text-emerald-600" />
                            )}
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Badge
                                    variant="secondary"
                                    className={cn(
                                        "text-xs",
                                        hasDowntime ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                                    )}
                                >
                                    {hasDowntime ? 'Parada' : 'Produzindo'}
                                </Badge>
                            </div>
                            <div className={cn(
                                "font-mono text-3xl font-bold tracking-tight",
                                hasDowntime ? "text-red-700" : "text-emerald-700"
                            )}>
                                {formatTime(hours)}:{formatTime(minutes)}:{formatTime(seconds)}
                            </div>
                        </div>
                    </div>

                    <div className="text-right space-y-2">
                        <div className="flex items-center gap-2 text-sm text-slate-600 justify-end">
                            <User className="w-4 h-4" />
                            <span>{session.operator_name || 'Operador'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 justify-end">
                            <Calendar className="w-4 h-4" />
                            <span>{session.shift_name || 'Turno'}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                            Tempo produtivo: {productiveHours}h {productiveMinutes}min
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}