import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Factory, RefreshCw, LogOut, Clock } from "lucide-react";
import { createPageUrl } from "@/utils";
import MachineCard from "@/components/production/MachineCard";
import ShiftSelector from "@/components/production/ShiftSelector";
import { cn } from "@/lib/utils";

// Identifica turno atual baseado na hora
function detectCurrentShift(shifts) {
    if (!shifts.length) return null;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    return shifts.find(s => {
        if (!s.start_time || !s.end_time) return false;
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        const start = sh * 60 + sm;
        const end = eh * 60 + em;
        if (start <= end) return currentMins >= start && currentMins < end;
        // Turno vira meia-noite
        return currentMins >= start || currentMins < end;
    }) || shifts[0];
}

export default function MachineSelection() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [selectedMachine, setSelectedMachine] = useState(null);
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        base44.auth.me().then(setUser).catch(() => { });
    }, []);

    const { data: machines = [], isLoading: loadingMachines, refetch: refetchMachines } = useQuery({
        queryKey: ['machines'],
        queryFn: () => base44.entities.Machine.filter({ active: true }),
        refetchInterval: 5000
    });

    const { data: shifts = [] } = useQuery({
        queryKey: ['shifts'],
        queryFn: () => base44.entities.Shift.filter({ active: true })
    });

    const { data: sessions = [] } = useQuery({
        queryKey: ['active-sessions'],
        queryFn: () => base44.entities.Session.filter({ status: 'active' }),
        refetchInterval: 5000
    });

    const filteredMachines = machines.filter(m =>
        m.code?.toLowerCase().includes(search.toLowerCase()) ||
        m.name?.toLowerCase().includes(search.toLowerCase()) ||
        m.sector?.toLowerCase().includes(search.toLowerCase())
    );

    const handleMachineSelect = (machine) => {
        setSelectedMachine(machine);
        const normalizedRole = normalizeRole(user?.role);
        if (normalizedRole === ROLE_IDS.MACHINE_OPERATOR) {
            const autoShift = detectCurrentShift(shifts);
            if (autoShift) {
                navigate(createPageUrl('Production') + `?machine=${machine.id}&shift=${autoShift.id}`);
                return;
            }
        }
        setShowShiftModal(true);
    };

    const handleShiftSelect = async (shift) => {
        navigate(createPageUrl('Production') + `?machine=${selectedMachine.id}&shift=${shift.id}`);
    };

    const handleLogout = () => {
        base44.auth.logout();
    };

    const getMachineSession = (machineId) => {
        return sessions.find(s => s.machine_id === machineId);
    };

    const statusCounts = {
        available: machines.filter(m => m.status === 'available').length,
        in_production: machines.filter(m => m.status === 'in_production').length,
        maintenance: machines.filter(m => m.status === 'maintenance').length,
        inactive: machines.filter(m => m.status === 'inactive').length
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
                                <Factory className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">Apontamento de Produção</h1>
                                <p className="text-sm text-slate-500">Selecione uma máquina para iniciar</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {user && (
                                <div className="text-right mr-4">
                                    <p className="text-sm font-medium text-slate-900">{user.full_name}</p>
                                    <div className="flex items-center justify-end gap-2">
                                        <Badge className="text-xs bg-emerald-100 text-emerald-700 capitalize">{user.role || 'operador'}</Badge>
                                        {user.role === 'operador' && shifts.length > 0 && (
                                            <Badge variant="outline" className="text-xs flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {detectCurrentShift(shifts)?.name || '—'}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            )}
                            <Button variant="outline" size="icon" onClick={() => refetchMachines()}>
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={handleLogout}>
                                <LogOut className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                {/* Status Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-emerald-50 border-emerald-200">
                        <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-emerald-700">{statusCounts.available}</p>
                            <p className="text-sm text-emerald-600">Disponíveis</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-blue-700">{statusCounts.in_production}</p>
                            <p className="text-sm text-blue-600">Em Produção</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-amber-50 border-amber-200">
                        <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-amber-700">{statusCounts.maintenance}</p>
                            <p className="text-sm text-amber-600">Manutenção</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-100 border-slate-200">
                        <CardContent className="p-4 text-center">
                            <p className="text-3xl font-bold text-slate-700">{statusCounts.inactive}</p>
                            <p className="text-sm text-slate-600">Inativas</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                        type="text"
                        placeholder="Buscar máquina por código, nome ou setor..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-12 h-14 text-lg bg-white border-slate-200"
                    />
                </div>

                {/* Machine Grid */}
                {loadingMachines ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <Card key={i} className="animate-pulse">
                                <CardContent className="p-5 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-slate-200" />
                                        <div className="flex-1">
                                            <div className="h-5 bg-slate-200 rounded w-24 mb-2" />
                                            <div className="h-4 bg-slate-100 rounded w-32" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : filteredMachines.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="p-12 text-center">
                            <Factory className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                            <h3 className="text-lg font-medium text-slate-600 mb-2">Nenhuma máquina encontrada</h3>
                            <p className="text-sm text-slate-500">Ajuste os filtros de busca ou verifique o cadastro</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredMachines.map(machine => {
                            const session = getMachineSession(machine.id);
                            return (
                                <MachineCard
                                    key={machine.id}
                                    machine={machine}
                                    onClick={handleMachineSelect}
                                    selected={selectedMachine?.id === machine.id}
                                    hasDowntime={session?.has_open_downtime}
                                />
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Shift Modal */}
            <ShiftSelector
                open={showShiftModal}
                onClose={() => {
                    setShowShiftModal(false);
                    setSelectedMachine(null);
                }}
                onSelect={handleShiftSelect}
                shifts={shifts}
            />
        </div>
    );
}