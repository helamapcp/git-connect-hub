/**
 * Painel de OPs de Composto na PMP
 * - Lista OPs abertas e em produção
 * - Permite registrar produção: bateladas realizadas, kg produzido, nº bags
 * - Finaliza a OP e cria as ProductionBags
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, CheckCircle2, PlayCircle, FlaskConical, Package, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { updateBalance } from './StockLocalBase.jsx';

const STATUS_CFG = {
    aberta: { label: 'Aberta', color: 'bg-blue-100 text-blue-700' },
    em_producao: { label: 'Em Produção', color: 'bg-amber-100 text-amber-700' },
    finalizada: { label: 'Finalizada', color: 'bg-emerald-100 text-emerald-700' },
    cancelada: { label: 'Cancelada', color: 'bg-slate-100 text-slate-500' },
};

function RegistrarProducaoModal({ op, onClose, onSuccess }) {
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    const [form, setForm] = useState({
        num_bateladas_realizadas: op.num_bateladas_realizadas || 0,
        total_composto_kg: op.total_composto_kg > 0 ? op.total_composto_kg : '',
        num_bags: op.num_bags > 0 ? op.num_bags : '',
        observacoes: op.observacoes || '',
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { base44.auth.me().then(setUser).catch(() => { }); }, []);

    const pesoMedioBag = form.total_composto_kg && form.num_bags
        ? (parseFloat(form.total_composto_kg) / parseInt(form.num_bags)).toFixed(2)
        : null;

    const handleFinalizar = async () => {
        if (!form.total_composto_kg || parseFloat(form.total_composto_kg) <= 0) {
            toast.error('Informe o total de composto produzido'); return;
        }
        if (!form.num_bags || parseInt(form.num_bags) <= 0) {
            toast.error('Informe o número de bags produzidas'); return;
        }
        if (parseInt(form.num_bateladas_realizadas) <= 0) {
            toast.error('Informe o número de bateladas realizadas'); return;
        }

        setSubmitting(true);
        const now = new Date().toISOString();
        const totalComposto = parseFloat(parseFloat(form.total_composto_kg).toFixed(2));
        const numBags = parseInt(form.num_bags);
        const pesoMedio = parseFloat((totalComposto / numBags).toFixed(2));

        // Atualizar OP
        await base44.entities.OPComposto.update(op.id, {
            status: 'finalizada',
            num_bateladas_realizadas: parseInt(form.num_bateladas_realizadas),
            total_composto_kg: totalComposto,
            num_bags: numBags,
            peso_medio_bag_kg: pesoMedio,
            observacoes: form.observacoes,
            data_finalizacao: now,
        });

        // Criar ProductionBags
        const bags = Array.from({ length: numBags }, (_, i) => ({
            batch_code: op.batch_code,
            bag_number: i + 1,
            weight_kg: pesoMedio,
            remaining_kg: pesoMedio,
            location_code: 'PMP',
            status: 'stored',
            operator_id: user?.id,
            operator_name: user?.full_name,
            notes: `OP ${op.numero} — ${op.formulacao_nome}`,
            active: true,
        }));
        await base44.entities.ProductionBag.bulkCreate(bags);

        // StockMovement
        await base44.entities.StockMovement.create({
            batch_code: op.batch_code,
            location_code: 'PMP',
            movement_type: 'production_output',
            total_kg: totalComposto,
            reference_id: op.id,
            operator_id: user?.id,
            operator_name: user?.full_name,
            timestamp: now,
            notes: `OP ${op.numero}`,
        });

        // Registrar entrada de composto no StockEntry
        await base44.entities.StockEntry.create({
            tipo_movimento: 'producao_composto',
            local_origem: 'PMP',
            local_destino: 'PMP',
            material_id: op.formulacao_id,
            material_nome: op.formulacao_nome,
            material_tipo: 'composto',
            quantidade_kg: totalComposto,
            referencia_id: op.id,
            observacoes: `OP ${op.numero} — ${numBags} bags de ${pesoMedio} kg`,
            operator_id: user?.id, operator_name: user?.full_name,
            data_lancamento: now, active: true,
        });

        queryClient.invalidateQueries(['ops-composto']);
        queryClient.invalidateQueries(['compostos-producao']);
        queryClient.invalidateQueries(['factory-bags']);
        queryClient.invalidateQueries(['transfer-bags-pmp']);

        toast.success(`OP ${op.numero} finalizada! ${numBags} bags de ${pesoMedio} kg criadas.`);
        onSuccess?.();
        onClose();
        setSubmitting(false);
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FlaskConical className="w-5 h-5 text-amber-600" />
                        Registrar Produção — {op.numero}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Info da OP */}
                    <div className="p-3 bg-slate-50 rounded-xl text-sm space-y-1">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Formulação:</span>
                            <span className="font-medium">{op.formulacao_nome}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Misturador:</span>
                            <span className="font-medium">{op.misturador}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Bateladas planejadas:</span>
                            <span className="font-bold text-blue-700">{op.num_bateladas_planejadas}</span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label>Bateladas Realizadas *</Label>
                        <Input
                            type="number" min="1" step="1"
                            value={form.num_bateladas_realizadas}
                            onChange={e => setForm(f => ({ ...f, num_bateladas_realizadas: e.target.value }))}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Total Composto Produzido (kg) *</Label>
                            <Input
                                type="number" min="0.01" step="0.01" placeholder="0.00"
                                value={form.total_composto_kg}
                                onChange={e => setForm(f => ({ ...f, total_composto_kg: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Número de Bags *</Label>
                            <Input
                                type="number" min="1" step="1" placeholder="0"
                                value={form.num_bags}
                                onChange={e => setForm(f => ({ ...f, num_bags: e.target.value }))}
                            />
                        </div>
                    </div>

                    {pesoMedioBag && (
                        <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                            <div>
                                <p className="text-amber-600 text-xs">Peso médio por bag</p>
                                <p className="font-bold text-amber-800 text-lg">{pesoMedioBag} kg</p>
                            </div>
                            <div>
                                <p className="text-amber-600 text-xs">Bags × {pesoMedioBag} kg</p>
                                <p className="font-bold text-slate-800 text-lg">{form.num_bags} bags</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-1">
                        <Label>Observações</Label>
                        <Input
                            value={form.observacoes}
                            onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                            placeholder="Observações..."
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleFinalizar} disabled={submitting} className="bg-amber-600 hover:bg-amber-700">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        {submitting ? 'Finalizando...' : 'Finalizar OP'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function OPCompostoPanel() {
    const queryClient = useQueryClient();
    const [selectedOP, setSelectedOP] = useState(null);
    const [filterStatus, setFilterStatus] = useState('aberta');

    const { data: ops = [], isLoading } = useQuery({
        queryKey: ['ops-composto'],
        queryFn: () => base44.entities.OPComposto.filter({ active: true }),
        refetchInterval: 15000,
    });

    const filtered = filterStatus === 'todas'
        ? ops
        : ops.filter(o => o.status === filterStatus);

    const sortedOps = [...filtered].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-amber-600" />
                    Ordens de Produção de Composto
                </h3>
                <div className="flex gap-1">
                    {['aberta', 'em_producao', 'finalizada', 'todas'].map(s => (
                        <Button
                            key={s}
                            size="sm"
                            variant={filterStatus === s ? 'default' : 'outline'}
                            onClick={() => setFilterStatus(s)}
                            className="text-xs"
                        >
                            {s === 'todas' ? 'Todas' : STATUS_CFG[s]?.label}
                        </Button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
                </div>
            ) : sortedOps.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-slate-400">
                        <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>Nenhuma OP encontrada</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {sortedOps.map(op => {
                        const cfg = STATUS_CFG[op.status] || STATUS_CFG.aberta;
                        return (
                            <Card key={op.id} className="overflow-hidden">
                                <CardContent className="p-4">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                                                <FlaskConical className="w-5 h-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-slate-900">{op.numero}</span>
                                                    <Badge className={cn("text-xs", cfg.color)}>{cfg.label}</Badge>
                                                    <Badge variant="outline" className="font-mono text-xs">{op.batch_code}</Badge>
                                                </div>
                                                <div className="text-sm text-slate-500 mt-0.5">
                                                    {op.formulacao_nome} • Misturador: <span className="font-medium text-slate-700">{op.misturador}</span>
                                                </div>
                                                {op.data_abertura && (
                                                    <p className="text-xs text-slate-400">
                                                        Aberta: {format(new Date(op.data_abertura), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="text-center">
                                                <p className="text-xs text-slate-400">Bateladas</p>
                                                <p className="font-bold text-slate-800">
                                                    {op.num_bateladas_realizadas}/{op.num_bateladas_planejadas}
                                                </p>
                                            </div>
                                            {op.status === 'finalizada' && (
                                                <>
                                                    <div className="text-center">
                                                        <p className="text-xs text-slate-400">Composto</p>
                                                        <p className="font-bold text-emerald-700">{(op.total_composto_kg || 0).toFixed(2)} kg</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-xs text-slate-400">Bags</p>
                                                        <p className="font-bold text-blue-700">{op.num_bags}</p>
                                                    </div>
                                                    {op.peso_medio_bag_kg && (
                                                        <div className="text-center">
                                                            <p className="text-xs text-slate-400">kg/bag</p>
                                                            <p className="font-bold text-slate-700">{op.peso_medio_bag_kg.toFixed(2)}</p>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            {(op.status === 'aberta' || op.status === 'em_producao') && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => setSelectedOP(op)}
                                                    className="bg-amber-600 hover:bg-amber-700"
                                                >
                                                    <PlayCircle className="w-4 h-4 mr-1" />
                                                    Registrar Produção
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {selectedOP && (
                <RegistrarProducaoModal
                    op={selectedOP}
                    onClose={() => setSelectedOP(null)}
                    onSuccess={() => setSelectedOP(null)}
                />
            )}
        </div>
    );
}