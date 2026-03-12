import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    ArrowLeft, Square, AlertTriangle, Trash2, Package,
    CheckCircle, Scale, Plus, Clock, RotateCcw, Truck
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import OrderStatusPanel from "@/components/production/OrderStatusPanel";
import DowntimeModal from "@/components/production/DowntimeModal";
import SessionTimer from "@/components/production/SessionTimer";
import TelhaEntryModal from "@/components/production/TelhaEntryModal";
import ForroEntryModal from "@/components/production/ForroEntryModal";
import WeightSampleModal from "@/components/production/WeightSampleModal";
import PedidoInterruptModal from "@/components/production/PedidoInterruptModal";

// Função auxiliar para label de peso médio por categoria
function pesoMedioLabel(cat) {
    if (!cat) return '';
    if (['TELHA'].includes(cat)) return 'Peso Médio (30 min)';
    if (['FORRO', 'ACABAMENTO'].includes(cat)) return 'Peso Médio (1 hora)';
    return '';
}

// Arredonda para múltiplo de 30min
function roundTo30Min(date = new Date()) {
    const ms = 30 * 60 * 1000;
    return new Date(Math.floor(date.getTime() / ms) * ms);
}

// Arredonda para hora cheia
function roundToHour(date = new Date()) {
    const d = new Date(date);
    d.setMinutes(0, 0, 0);
    return d;
}

// Retorna o timestamp de referência e o tipo de intervalo conforme a categoria
function getIntervalRef(categoria) {
    if (TELHA_CATEGORIES.includes(categoria)) return { ref: roundTo30Min(), tipo: '30MIN' };
    return { ref: roundToHour(), tipo: '1H' };
}

const TELHA_CATEGORIES = ['TELHA'];
const CAIXA_CATEGORIES = ['FORRO', 'ACABAMENTO'];

const statusLabel = {
    PLANEJADA: 'Planejada', LIBERADA: 'Liberada', EM_PRODUCAO: 'Em Produção',
    PAUSADA: 'Pausada', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada',
    pending: 'Pendente', in_progress: 'Em Produção', paused: 'Pausada',
    completed: 'Concluída', cancelled: 'Cancelada'
};

export default function Production() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const urlParams = new URLSearchParams(window.location.search);
    const machineId = urlParams.get('machine');
    const shiftId = urlParams.get('shift');

    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [currentDowntime, setCurrentDowntime] = useState(null);

    // Modals
    const [showDowntimeModal, setShowDowntimeModal] = useState(false);
    const [isClosingDowntime, setIsClosingDowntime] = useState(false);
    const [showTelhaModal, setShowTelhaModal] = useState(false);
    const [showForroModal, setShowForroModal] = useState(false);
    const [showWeightModal, setShowWeightModal] = useState(false);
    const [showInterruptModal, setShowInterruptModal] = useState(false);
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [pendingPedidoOrder, setPendingPedidoOrder] = useState(null); // OP_PEDIDO aguardando iniciar
    const [pausedPadraoOrder, setPausedPadraoOrder] = useState(null);   // OP_PADRAO pausada

    useEffect(() => {
        base44.auth.me().then(setUser).catch(() => navigate(createPageUrl('MachineSelection')));
    }, []);

    // ── Queries ───────────────────────────────────────────────────
    const { data: machine } = useQuery({
        queryKey: ['machine', machineId],
        queryFn: async () => {
            const all = await base44.entities.Machine.list();
            return all.find(m => m.id === machineId) || null;
        },
        enabled: !!machineId
    });

    const { data: shift } = useQuery({
        queryKey: ['shift', shiftId],
        queryFn: async () => {
            const all = await base44.entities.Shift.list();
            return all.find(s => s.id === shiftId) || null;
        },
        enabled: !!shiftId
    });

    const { data: allOrders = [], refetch: refetchOrders } = useQuery({
        queryKey: ['all-orders-machine', machineId],
        queryFn: async () => {
            const all = await base44.entities.ProductionOrder.filter({ active: true });
            return all.filter(o =>
                (o.machine_id === machineId || !o.machine_id) &&
                ['LIBERADA', 'EM_PRODUCAO', 'PAUSADA', 'pending', 'in_progress', 'paused'].includes(o.status)
            );
        },
        refetchInterval: 5000,
        enabled: !!machineId
    });

    const { data: downtimeReasons = [] } = useQuery({
        queryKey: ['downtime-reasons'],
        queryFn: () => base44.entities.DowntimeReason.filter({ active: true })
    });

    const { data: lotes = [] } = useQuery({
        queryKey: ['lotes-disponiveis'],
        queryFn: () => base44.entities.MaterialLote.filter({ active: true }),
        refetchInterval: 10000
    });

    const { data: activeSession, refetch: refetchSession } = useQuery({
        queryKey: ['active-session', machineId],
        queryFn: async () => {
            const all = await base44.entities.Session.list('-created_date', 50);
            return all.find(s => s.machine_id === machineId && s.status === 'active') || null;
        },
        enabled: !!machineId,
        refetchInterval: 5000
    });

    useEffect(() => {
        if (activeSession) {
            setSession(activeSession);
            if (activeSession.order_id && !selectedOrder) {
                base44.entities.ProductionOrder.list().then(all => {
                    const found = all.find(o => o.id === activeSession.order_id);
                    if (found) setSelectedOrder(found);
                });
            }
        }
    }, [activeSession]);

    const { data: openDowntime, refetch: refetchDowntime } = useQuery({
        queryKey: ['open-downtime', session?.id],
        queryFn: async () => {
            if (!session?.id) return null;
            const all = await base44.entities.DowntimeEvent.list('-start_time', 20);
            return all.find(d => d.session_id === session.id && d.status === 'open') || null;
        },
        enabled: !!session?.id,
        refetchInterval: 5000
    });

    useEffect(() => { setCurrentDowntime(openDowntime); }, [openDowntime]);

    // Verifica se há OP_PADRAO pausada para esta máquina
    const pausedPadraoQuery = useQuery({
        queryKey: ['paused-padrao', machineId],
        queryFn: async () => {
            const all = await base44.entities.ProductionOrder.filter({ active: true });
            return all.find(o => o.machine_id === machineId && (o.status === 'PAUSADA' || o.status === 'paused') && o.order_type === 'PADRAO') || null;
        },
        enabled: !!machineId,
        refetchInterval: 10000
    });

    useEffect(() => {
        if (pausedPadraoQuery.data) setPausedPadraoOrder(pausedPadraoQuery.data);
    }, [pausedPadraoQuery.data]);

    // Verifica se há amostra de peso para o intervalo atual (TELHA)
    const { data: lastWeightSample } = useQuery({
        queryKey: ['last-weight', session?.id],
        queryFn: async () => {
            if (!session?.id) return null;
            const all = await base44.entities.WeightSample.list('-timestamp', 10);
            return all.find(w => w.session_id === session.id) || null;
        },
        enabled: !!session?.id,
        refetchInterval: 30000
    });

    const weightSampleRequired = (() => {
        if (!session || !selectedOrder) return false;
        const cat = selectedOrder.categoria_processo;
        const isTelhaOrForro = TELHA_CATEGORIES.includes(cat) || ['FORRO', 'ACABAMENTO'].includes(cat);
        if (!isTelhaOrForro) return false;
        const { ref } = getIntervalRef(cat);
        if (!lastWeightSample) return true; // nunca registrou
        const lastRef = new Date(lastWeightSample.timestamp_referencia);
        return ref.getTime() > lastRef.getTime();
    })();

    // ── Mutations ─────────────────────────────────────────────────
    const startSession = useMutation({
        mutationFn: async (order) => {
            const now = new Date().toISOString();
            const newSession = await base44.entities.Session.create({
                machine_id: machineId, machine_code: machine?.code,
                order_id: order.id, order_number: order.order_number,
                order_type: order.order_type || 'PADRAO',
                operator_id: user?.id, operator_name: user?.full_name,
                shift_id: shiftId, shift_name: shift?.name,
                start_time: now, status: 'active'
            });
            await base44.entities.ProductionOrder.update(order.id, {
                status: 'EM_PRODUCAO', machine_id: machineId, machine_code: machine?.code,
                start_date: order.start_date || now
            });
            await base44.entities.Machine.update(machineId, {
                status: 'in_production', current_session_id: newSession.id, current_order_id: order.id
            });
            return newSession;
        },
        onSuccess: (newSession, order) => {
            setSession(newSession);
            setSelectedOrder(order);
            refetchSession();
            refetchOrders();
            toast.success('Sessão iniciada!');
        }
    });

    const endSession = useMutation({
        mutationFn: async () => {
            const now = new Date().toISOString();
            if (currentDowntime) {
                const dur = Math.round((Date.now() - new Date(currentDowntime.start_time).getTime()) / 60000);
                await base44.entities.DowntimeEvent.update(currentDowntime.id, { end_time: now, duration_minutes: dur, status: 'closed' });
            }
            await base44.entities.Session.update(session.id, { end_time: now, status: 'completed' });
            await base44.entities.Machine.update(machineId, { status: 'available', current_session_id: null, current_order_id: null });

            // Se é OP_PEDIDO, atualizar status para FINALIZADA
            if (selectedOrder?.order_type === 'PEDIDO') {
                await base44.entities.ProductionOrder.update(selectedOrder.id, { status: 'FINALIZADA', end_date: now });
            }
        },
        onSuccess: async () => {
            // Se OP_PEDIDO finalizada e existe OP_PADRAO pausada → mostrar modal de retomada
            if (selectedOrder?.order_type === 'PEDIDO' && pausedPadraoOrder) {
                setShowResumeModal(true);
            } else {
                toast.success('Sessão encerrada!');
                navigate(createPageUrl('MachineSelection'));
            }
            setSession(null);
            setCurrentDowntime(null);
        }
    });

    // Interromper OP_PADRAO para iniciar OP_PEDIDO
    const interruptForPedido = useMutation({
        mutationFn: async (pedidoOrder) => {
            const now = new Date().toISOString();
            // Encerrar sessão atual
            if (currentDowntime) {
                const dur = Math.round((Date.now() - new Date(currentDowntime.start_time).getTime()) / 60000);
                await base44.entities.DowntimeEvent.update(currentDowntime.id, { end_time: now, duration_minutes: dur, status: 'closed' });
            }
            await base44.entities.Session.update(session.id, { end_time: now, status: 'completed' });
            // Pausar OP_PADRAO
            await base44.entities.ProductionOrder.update(selectedOrder.id, { status: 'PAUSADA', paused_at: now });
            // Iniciar nova sessão para OP_PEDIDO
            const newSession = await base44.entities.Session.create({
                machine_id: machineId, machine_code: machine?.code,
                order_id: pedidoOrder.id, order_number: pedidoOrder.order_number,
                order_type: 'PEDIDO',
                operator_id: user?.id, operator_name: user?.full_name,
                shift_id: shiftId, shift_name: shift?.name,
                start_time: now, status: 'active'
            });
            await base44.entities.ProductionOrder.update(pedidoOrder.id, {
                status: 'EM_PRODUCAO', machine_id: machineId, machine_code: machine?.code, start_date: now
            });
            await base44.entities.Machine.update(machineId, {
                status: 'in_production', current_session_id: newSession.id, current_order_id: pedidoOrder.id
            });
            return { newSession, pedidoOrder };
        },
        onSuccess: ({ newSession, pedidoOrder }) => {
            setSession(newSession);
            setSelectedOrder(pedidoOrder);
            setCurrentDowntime(null);
            setShowInterruptModal(false);
            setPendingPedidoOrder(null);
            refetchSession();
            refetchOrders();
            toast.success('OP de Pedido iniciada! OP Padrão pausada.');
        }
    });

    // Retomar OP_PADRAO após finalizar OP_PEDIDO
    const resumePadrao = useMutation({
        mutationFn: async () => {
            const now = new Date().toISOString();
            const newSession = await base44.entities.Session.create({
                machine_id: machineId, machine_code: machine?.code,
                order_id: pausedPadraoOrder.id, order_number: pausedPadraoOrder.order_number,
                order_type: 'PADRAO',
                operator_id: user?.id, operator_name: user?.full_name,
                shift_id: shiftId, shift_name: shift?.name,
                start_time: now, status: 'active'
            });
            await base44.entities.ProductionOrder.update(pausedPadraoOrder.id, { status: 'EM_PRODUCAO' });
            await base44.entities.Machine.update(machineId, {
                status: 'in_production', current_session_id: newSession.id, current_order_id: pausedPadraoOrder.id
            });
            return { newSession, order: pausedPadraoOrder };
        },
        onSuccess: ({ newSession, order }) => {
            setSession(newSession);
            setSelectedOrder(order);
            setPausedPadraoOrder(null);
            setShowResumeModal(false);
            refetchSession();
            refetchOrders();
            toast.success('OP Padrão retomada!');
        }
    });

    // Registrar apontamento (genérico + TELHA + FORRO)
    const recordProduction = useMutation({
        mutationFn: async (entryData) => {
            const now = new Date().toISOString();
            const { quantity, refugo_processo_kg = 0, refugo_telha_un = 0, refugo_telha_kg_calculado = 0,
                tipo_b_un = 0, capstock_consumo_kg = 0, peso_medio_amostrado, lote_id, lote_codigo, categoria_processo } = entryData;

            // Se há lote, debitar
            if (lote_id) {
                const lote = lotes.find(l => l.id === lote_id);
                if (lote) {
                    const novoDisp = (lote.peso_disponivel || 0) - capstock_consumo_kg;
                    if (novoDisp < 0) throw new Error('Peso disponível no lote insuficiente!');
                    await base44.entities.MaterialLote.update(lote_id, {
                        peso_disponivel: novoDisp,
                        peso_consumido: (lote.peso_consumido || 0) + capstock_consumo_kg,
                        status: novoDisp <= 0 ? 'esgotado' : 'em_uso'
                    });
                }
            }

            // Salvar peso médio se informado
            const isTelhaOrForro = TELHA_CATEGORIES.includes(categoria_processo) || ['FORRO', 'ACABAMENTO'].includes(categoria_processo);
            if (peso_medio_amostrado && isTelhaOrForro) {
                const { ref: refTime, tipo: intervaloTipo } = getIntervalRef(categoria_processo);
                // Verificar duplicidade pelo timestamp de referência
                const existingSamples = await base44.entities.WeightSample.list('-timestamp', 10);
                const already = existingSamples.find(w =>
                    w.session_id === session.id &&
                    new Date(w.timestamp_referencia).getTime() === refTime.getTime()
                );
                if (already) {
                    toast.warning('Já existe peso médio registrado para este intervalo.');
                } else {
                    await base44.entities.WeightSample.create({
                        session_id: session.id, machine_id: machineId,
                        operator_id: user?.id, operator_name: user?.full_name,
                        categoria_processo, intervalo_tipo: intervaloTipo,
                        peso_medio: peso_medio_amostrado,
                        timestamp: now, timestamp_referencia: refTime.toISOString()
                    });
                }
            }

            // Salvar entrada de produção
            await base44.entities.ProductionEntry.create({
                session_id: session.id, order_id: selectedOrder.id,
                machine_id: machineId, operator_id: user?.id,
                categoria_processo, quantity,
                unit: selectedOrder.unidade_producao || selectedOrder.unit || 'unidades',
                refugo_processo_kg, refugo_telha_un, refugo_telha_kg_calculado,
                tipo_b_un, capstock_consumo_kg, peso_medio_amostrado,
                lote_composto_id: lote_id, lote_composto_codigo: lote_codigo,
                consumo_composto_kg: capstock_consumo_kg,
                timestamp: now
            });

            // Atualizar OP
            const newProduced = (selectedOrder.quantity_produced || 0) + quantity;
            const newLoss = (selectedOrder.quantity_loss || 0) + refugo_processo_kg;
            const newRefugoTelha = (selectedOrder.refugo_telha_kg_total || 0) + refugo_telha_kg_calculado;
            const newTipoB = (selectedOrder.tipo_b_total || 0) + tipo_b_un;
            await base44.entities.ProductionOrder.update(selectedOrder.id, {
                quantity_produced: newProduced, quantity_loss: newLoss,
                refugo_telha_kg_total: newRefugoTelha, tipo_b_total: newTipoB
            });

            // Atualizar sessão
            const newSessionTotal = (session.total_produced || 0) + quantity;
            const newRefugoProc = (session.total_refugo_processo_kg || 0) + refugo_processo_kg;
            const newRefugoTelhaS = (session.total_refugo_telha_kg || 0) + refugo_telha_kg_calculado;
            const newTipoBSession = (session.total_tipo_b_un || 0) + tipo_b_un;
            await base44.entities.Session.update(session.id, {
                total_produced: newSessionTotal,
                total_refugo_processo_kg: newRefugoProc,
                total_refugo_telha_kg: newRefugoTelhaS,
                total_tipo_b_un: newTipoBSession
            });

            return { quantity, newProduced, newSessionTotal };
        },
        onSuccess: ({ quantity, newProduced, newSessionTotal }) => {
            setSelectedOrder(prev => ({ ...prev, quantity_produced: newProduced }));
            setSession(prev => ({ ...prev, total_produced: newSessionTotal }));
            queryClient.invalidateQueries(['all-orders-machine']);
            toast.success(`+${quantity} apontado!`);
        },
        onError: (err) => toast.error(err.message || 'Erro ao salvar apontamento')
    });

    const startDowntime = useMutation({
        mutationFn: async (reason) => {
            const now = new Date().toISOString();
            const downtime = await base44.entities.DowntimeEvent.create({
                session_id: session.id, machine_id: machineId,
                reason_id: reason.id, reason_name: reason.name, reason_category: reason.category,
                start_time: now, status: 'open', operator_id: user?.id
            });
            await base44.entities.Session.update(session.id, { has_open_downtime: true });
            return downtime;
        },
        onSuccess: (downtime) => {
            setCurrentDowntime(downtime);
            setSession(prev => ({ ...prev, has_open_downtime: true }));
            toast.warning('Parada registrada!');
        }
    });

    const endDowntime = useMutation({
        mutationFn: async () => {
            const now = new Date().toISOString();
            const dur = Math.round((Date.now() - new Date(currentDowntime.start_time).getTime()) / 60000);
            await base44.entities.DowntimeEvent.update(currentDowntime.id, { end_time: now, duration_minutes: dur, status: 'closed' });
            const newTotal = (session.total_downtime_minutes || 0) + dur;
            await base44.entities.Session.update(session.id, { has_open_downtime: false, total_downtime_minutes: newTotal });
            return { dur, newTotal };
        },
        onSuccess: ({ dur, newTotal }) => {
            setCurrentDowntime(null);
            setSession(prev => ({ ...prev, has_open_downtime: false, total_downtime_minutes: newTotal }));
            refetchDowntime();
            toast.success(`Parada encerrada (${dur} min)`);
        }
    });

    const recordWeightSample = useMutation({
        mutationFn: (data) => base44.entities.WeightSample.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['last-weight']);
            toast.success('Peso médio registrado!');
        }
    });

    // ── Handlers ─────────────────────────────────────────────────
    const handleSelectOrderClick = (order) => {
        if (!session) {
            // Sem sessão ativa: iniciar diretamente
            startSession.mutateAsync(order);
            return;
        }
        // Sessão ativa
        const activaOrderType = session.order_type || 'PADRAO';
        if (order.order_type === 'PEDIDO') {
            if (activaOrderType === 'PEDIDO') {
                // Não permite 2 OP PEDIDO simultâneas
                toast.error('Finalize a OP de Pedido atual antes de iniciar outra.');
                return;
            }
            // OP PADRÃO ativa → interromper para OP PEDIDO
            setPendingPedidoOrder(order);
            setShowInterruptModal(true);
        }
        // Clicar na OP já ativa não faz nada
    };

    const handleApontamento = () => {
        if (!session || !selectedOrder) return;
        const cat = selectedOrder.categoria_processo;
        if (TELHA_CATEGORIES.includes(cat)) setShowTelhaModal(true);
        else setShowForroModal(true);
    };

    const handleDowntimeClick = () => {
        if (currentDowntime) setIsClosingDowntime(true);
        else setIsClosingDowntime(false);
        setShowDowntimeModal(true);
    };

    const handleDowntimeConfirm = async (reason) => {
        if (isClosingDowntime) await endDowntime.mutateAsync();
        else await startDowntime.mutateAsync(reason);
    };

    // ── Guards ───────────────────────────────────────────────────
    if (machineId && !machine) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <p className="text-slate-500 text-lg animate-pulse">Carregando máquina...</p>
            </div>
        );
    }

    if (!machineId) {
        return (
            <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-4">
                <p className="text-slate-600 text-lg">Nenhuma máquina selecionada.</p>
                <button onClick={() => navigate(createPageUrl('MachineSelection'))}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700">
                    Selecionar Máquina
                </button>
            </div>
        );
    }

    const isTelha = TELHA_CATEGORIES.includes(selectedOrder?.categoria_processo);
    const isPedidoActive = session?.order_type === 'PEDIDO';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('MachineSelection'))}>
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <div>
                                <h1 className="text-lg font-bold text-slate-900">{machine?.code}</h1>
                                <p className="text-sm text-slate-500">{machine?.name}</p>
                            </div>
                            {isPedidoActive && (
                                <Badge className="bg-amber-100 text-amber-700 border border-amber-300">
                                    ⚡ Produção sob Pedido
                                </Badge>
                            )}
                            {pausedPadraoOrder && !isPedidoActive && (
                                <Badge className="bg-blue-100 text-blue-700 border border-blue-300 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> OP Padrão Pausada
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(createPageUrl('PATracking'))}
                                className="h-10"
                            >
                                <Truck className="w-4 h-4 mr-2" />
                                Ir para PA
                            </Button>
                            {session && (
                                <Button variant="outline" size="sm"
                                    onClick={() => endSession.mutate()} disabled={endSession.isPending}
                                    className="text-red-600 border-red-200 hover:bg-red-50 h-10">
                                    <Square className="w-4 h-4 mr-2" />
                                    Encerrar Sessão
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-4 space-y-4">
                <Card>
                    <CardContent className="p-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium">Fluxo:</span>
                            <Button size="sm" variant="secondary" onClick={() => navigate(createPageUrl('Orders'))}>OP</Button>
                            <span className="text-muted-foreground">→</span>
                            <Button size="sm" variant="secondary" onClick={() => navigate(createPageUrl('MachineSelection'))}>Produção</Button>
                            <span className="text-muted-foreground">→</span>
                            <Button size="sm" onClick={() => navigate(createPageUrl('PATracking'))}>PA</Button>
                            <span className="text-muted-foreground">→</span>
                            <Button size="sm" variant="outline" onClick={() => navigate(createPageUrl('FactoryDashboard'))}>Logística</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Alertas */}
                {weightSampleRequired && session && (
                    <Alert className="border-amber-400 bg-amber-50">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <AlertDescription className="text-amber-800 flex items-center justify-between">
                            <span>Intervalo de 30 min sem peso médio amostrado.</span>
                            <Button size="sm" className="ml-4 bg-amber-600 hover:bg-amber-700"
                                onClick={() => setShowWeightModal(true)}>
                                <Scale className="w-4 h-4 mr-1" /> Registrar Peso
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                <SessionTimer session={session} hasDowntime={!!currentDowntime} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Coluna esquerda */}
                    <div className="lg:col-span-2 space-y-4">
                        <OrderStatusPanel order={selectedOrder} session={session} />

                        {session && selectedOrder && (
                            <>
                                {/* Botão principal de apontamento */}
                                <Button
                                    size="lg"
                                    className="w-full h-20 text-xl font-bold bg-emerald-600 hover:bg-emerald-700"
                                    disabled={!!currentDowntime || recordProduction.isPending}
                                    onClick={handleApontamento}
                                >
                                    <Plus className="w-7 h-7 mr-3" />
                                    {isTelha ? 'Apontar Produção (TELHA)' : `Apontar Produção (${selectedOrder.categoria_processo || 'Produção'})`}
                                </Button>

                                {/* Peso médio (TELHA / FORRO) */}
                                {(isTelha || ['FORRO', 'ACABAMENTO'].includes(selectedOrder?.categoria_processo)) && (
                                    <Button variant="outline" size="lg" className="w-full h-14 border-violet-300 text-violet-700"
                                        onClick={() => setShowWeightModal(true)}>
                                        <Scale className="w-5 h-5 mr-2" />
                                        {pesoMedioLabel(selectedOrder?.categoria_processo) || 'Registrar Peso Médio'}
                                        {lastWeightSample && (
                                            <Badge className="ml-2 bg-violet-100 text-violet-700">
                                                Último: {lastWeightSample.peso_medio} kg
                                            </Badge>
                                        )}
                                    </Button>
                                )}

                                {/* Parada */}
                                <div className="grid grid-cols-2 gap-4">
                                    <Button size="lg"
                                        onClick={handleDowntimeClick}
                                        disabled={startDowntime.isPending || endDowntime.isPending}
                                        className={cn("h-16 text-lg font-semibold",
                                            currentDowntime ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-500 hover:bg-amber-600"
                                        )}>
                                        {currentDowntime ? (
                                            <><CheckCircle className="w-6 h-6 mr-2" />Encerrar Parada</>
                                        ) : (
                                            <><AlertTriangle className="w-6 h-6 mr-2" />Registrar Parada</>
                                        )}
                                    </Button>

                                    {/* Retomar OP Padrão (se disponível) */}
                                    {pausedPadraoOrder && isPedidoActive && (
                                        <Button size="lg" variant="outline"
                                            className="h-16 text-base border-blue-300 text-blue-700 hover:bg-blue-50"
                                            onClick={() => setShowResumeModal(true)}>
                                            <RotateCcw className="w-5 h-5 mr-2" />
                                            Ver OP Padrão Pausada
                                        </Button>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Info sem sessão */}
                        {!session && (
                            <Card className="border-dashed border-2 border-slate-300 bg-slate-50">
                                <CardContent className="p-8 text-center">
                                    <Package className="w-14 h-14 mx-auto mb-4 text-slate-300" />
                                    <p className="text-slate-600 font-medium">Selecione uma ordem ao lado para iniciar a produção</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Coluna direita – Lista de OPs */}
                    <div>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Package className="w-5 h-5" />
                                    Ordens Disponíveis
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {allOrders.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400">
                                        <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                                        <p className="text-sm">Nenhuma ordem disponível</p>
                                    </div>
                                ) : (
                                    <ScrollArea className="h-[500px]">
                                        <div className="space-y-2 pr-2">
                                            {allOrders.map(order => {
                                                const isActive = selectedOrder?.id === order.id;
                                                const isPedido = order.order_type === 'PEDIDO';
                                                const isPaused = ['PAUSADA', 'paused'].includes(order.status);
                                                const isInProd = ['EM_PRODUCAO', 'in_progress'].includes(order.status);
                                                const progress = order.quantity_planned > 0
                                                    ? Math.min(100, ((order.quantity_produced || 0) / order.quantity_planned * 100)).toFixed(0)
                                                    : 0;
                                                // Permite clicar em OP PEDIDO mesmo com sessão ativa (para interromper OP PADRÃO)
                                                const disabled = !!session && !isActive && !(isPedido && session.order_type === 'PADRAO');

                                                return (
                                                    <button key={order.id}
                                                        onClick={() => handleSelectOrderClick(order)}
                                                        disabled={disabled}
                                                        className={cn(
                                                            "w-full text-left p-4 rounded-xl border-2 transition-all",
                                                            "active:scale-[0.98]",
                                                            isActive ? "border-blue-500 bg-blue-50 shadow-md" :
                                                                disabled ? "border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed" :
                                                                    isPedido ? "border-amber-200 bg-amber-50 hover:border-amber-400" :
                                                                        "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                                                        )}>
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div>
                                                                <p className="font-bold text-slate-900 text-sm">{order.order_number}</p>
                                                                <p className="text-xs text-slate-600 mt-0.5">{order.product_name}</p>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1">
                                                                {isPedido && <Badge className="bg-amber-100 text-amber-700 text-xs">PEDIDO</Badge>}
                                                                {!isPedido && <Badge className="bg-slate-100 text-slate-600 text-xs">PADRÃO</Badge>}
                                                                {isPaused && <Badge className="bg-blue-100 text-blue-700 text-xs flex items-center gap-1"><Clock className="w-3 h-3" />Pausada</Badge>}
                                                                {isInProd && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Em Produção</Badge>}
                                                            </div>
                                                        </div>
                                                        {order.categoria_processo && (
                                                            <Badge variant="outline" className="text-xs mb-2">{order.categoria_processo}</Badge>
                                                        )}
                                                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                                                            <span>Meta: {order.quantity_planned} {order.unit}</span>
                                                            <span className="font-medium text-emerald-600">{order.quantity_produced || 0} ({progress}%)</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>

            {/* ── Modals ──────────────────────────────────────────── */}
            <DowntimeModal
                open={showDowntimeModal}
                onClose={() => setShowDowntimeModal(false)}
                onConfirm={handleDowntimeConfirm}
                reasons={downtimeReasons}
                isClosing={isClosingDowntime}
                currentDowntime={currentDowntime}
            />

            <TelhaEntryModal
                open={showTelhaModal}
                onClose={() => setShowTelhaModal(false)}
                onConfirm={(data) => recordProduction.mutate(data)}
                lotes={lotes}
                lastWeightSample={lastWeightSample}
                weightSampleRequired={weightSampleRequired}
            />

            <ForroEntryModal
                open={showForroModal}
                onClose={() => setShowForroModal(false)}
                onConfirm={(data) => recordProduction.mutate(data)}
                lotes={lotes}
                categoria={selectedOrder?.categoria_processo || 'FORRO'}
                lastWeightSample={lastWeightSample}
                weightSampleRequired={weightSampleRequired}
            />

            <WeightSampleModal
                open={showWeightModal}
                onClose={() => setShowWeightModal(false)}
                onConfirm={async (data) => {
                    // Verificar duplicidade antes de salvar
                    const existing = await base44.entities.WeightSample.list('-timestamp', 10);
                    const already = existing.find(w =>
                        w.session_id === session?.id &&
                        new Date(w.timestamp_referencia).getTime() === new Date(data.timestamp_referencia).getTime()
                    );
                    if (already) {
                        toast.error('Já existe peso médio registrado para este intervalo.');
                        return;
                    }
                    await recordWeightSample.mutateAsync(data);
                }}
                sessionId={session?.id}
                machineId={machineId}
                userId={user?.id}
                intervaloTipo={TELHA_CATEGORIES.includes(selectedOrder?.categoria_processo) ? '30MIN' : '1H'}
                categoriaProcesso={selectedOrder?.categoria_processo}
            />

            <PedidoInterruptModal
                open={showInterruptModal}
                onClose={() => { setShowInterruptModal(false); setPendingPedidoOrder(null); }}
                mode="interrupt"
                currentOrder={selectedOrder}
                pedidoOrder={pendingPedidoOrder}
                onConfirm={() => pendingPedidoOrder && interruptForPedido.mutate(pendingPedidoOrder)}
            />

            <PedidoInterruptModal
                open={showResumeModal}
                onClose={() => { setShowResumeModal(false); navigate(createPageUrl('MachineSelection')); }}
                mode="resume"
                currentOrder={pausedPadraoOrder}
                onConfirm={() => resumePadrao.mutate()}
                onSkip={() => { setShowResumeModal(false); navigate(createPageUrl('MachineSelection')); }}
            />
        </div>
    );
}