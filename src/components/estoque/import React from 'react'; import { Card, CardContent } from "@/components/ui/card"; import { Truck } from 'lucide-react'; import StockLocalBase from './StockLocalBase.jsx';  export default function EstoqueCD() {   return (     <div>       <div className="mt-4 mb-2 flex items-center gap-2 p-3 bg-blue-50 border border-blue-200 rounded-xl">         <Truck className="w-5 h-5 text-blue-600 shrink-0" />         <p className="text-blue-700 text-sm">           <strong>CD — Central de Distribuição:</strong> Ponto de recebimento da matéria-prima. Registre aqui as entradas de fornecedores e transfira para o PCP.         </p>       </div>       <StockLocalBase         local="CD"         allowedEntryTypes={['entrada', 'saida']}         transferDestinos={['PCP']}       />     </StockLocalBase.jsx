/**
 * Componente base reutilizável para cada aba de local de estoque.
 * Exibe saldo, histórico de entradas/saídas e botão de novo lançamento.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, TrendingUp, TrendingDown, ArrowRight, Package } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TIPO_LABEL = {
    entrada: { label: 'Entrada', color: 'bg-emerald-100 text-emerald-700', sign: '+' },
    saida: { label: 'Saída', color: 'bg-red-100 text-red-700', sign: '-' },
    transferencia_entrada: { label: 'Transf. Entrada', color: 'bg-blue-100 text-blue-700', sign: '+' },
    transferencia_saida: { label: 'Transf. Saída', color: 'bg-amber-100 text-amber-700', sign: '-' },
    producao_composto: { label: 'Prod. Composto', color: 'bg-violet-100 text-violet-700', sign: '+' },
};

async function updateBalance(local, materialId, materialNome, materialTipo, delta, queryClient) {
    const existing = await base44.entities.StockBalance.filter({ local, material_id: materialId });
    if (existing.length > 0) {
        const current = existing[0];
        await base44.entities.StockBalance.update(current.id, {
            quantidade_kg: Math.max(0, (current.quantidade_kg || 0) + delta),
            ultima_atualizacao: new Date().toISOString()
        });
    } else {
        await base44.entities.StockBalance.create({
            local, material_id: materialId, material_nome: materialNome, material_tipo: materialTipo,
            quantidade_kg: Math.max(0, delta),
            ultima_atualizacao: new Date().toISOString()
        });
    }
    queryClient.invalidateQueries(['stock-balances']);
}

export { updateBalance };

export default function StockLocalBase({ local, allowedEntryTypes = ['entrada'], transferDestinos = [], showTransferButton = false }) {
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('entrada'); // 'entrada' | 'saida' | 'transferencia'
    const [form, setForm] = useState({ material_id: '', quantidade_kg: '', lote_codigo: '', fornecedor: '', nota_fiscal: '', destino: '', observacoes: '' });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { base44.auth.me().then(setUser).catch(() => { }); }, []);

    const { data: materials = [] } = useQuery({
        queryKey: ['raw-materials'],
        queryFn: () => base44.entities.RawMaterial.filter({ ativo: true })
    });

    const { data: balances = [] } = useQuery({
        queryKey: ['stock-balances', local],
        queryFn: async () => {
            const all = await base44.entities.StockBalance.list();
            return all.filter(b => b.local === local);
        },
        refetchInterval: 15000
    });

    const { data: entries = [] } = useQuery({
        queryKey: ['stock-entries', local],
        queryFn: async () => {
            const all = await base44.entities.StockEntry.list('-data_lancamento', 100);
            return all.filter(e => e.local_origem === local || e.local_destino === local);
        },
        refetchInterval: 15000
    });

    const totalKg = balances.reduce((s, b) => s + (b.quantidade_kg || 0), 0);
    const selectedMaterial = materials.find(m => m.id === form.material_id);

    const openModal = (type) => {
        setModalType(type);
        setForm({ material_id: '', quantidade_kg: '', lote_codigo: '', fornecedor: '', nota_fiscal: '', destino: transferDestinos[0] || '', observacoes: '' });
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!form.material_id || !form.quantidade_kg || parseFloat(form.quantidade_kg) <= 0) {
            toast.error('Preencha material e quantidade'); return;
        }
        if (modalType === 'transferencia' && !form.destino) {
            toast.error('Selecione o destino'); return;
        }
        setSubmitting(true);
        const now = new Date().toISOString();
        const kg = parseFloat(form.quantidade_kg);
        const mat = selectedMaterial;

        if (modalType === 'entrada') {
            await base44.entities.StockEntry.create({
                tipo_movimento: 'entrada',
                local_origem: 'externo',
                local_destino: local,
                material_id: mat.id, material_nome: mat.nome, material_tipo: mat.tipo,
                quantidade_kg: kg,
                lote_codigo: form.lote_codigo, fornecedor: form.fornecedor, nota_fiscal: form.nota_fiscal,
                observacoes: form.observacoes,
                operator_id: user?.id, operator_name: user?.full_name,
                data_lancamento: now, active: true
            });
            await updateBalance(local, mat.id, mat.nome, mat.tipo, +kg, queryClient);
            toast.success(`Entrada de ${kg} kg registrada no ${local}`);
        } else if (modalType === 'saida') {
            const bal = balances.find(b => b.material_id === mat.id);
            if (!bal || bal.quantidade_kg < kg) { toast.error('Saldo insuficiente'); setSubmitting(false); return; }
            await base44.entities.StockEntry.create({
                tipo_movimento: 'saida',
                local_origem: local, local_destino: 'externo',
                material_id: mat.id, material_nome: mat.nome, material_tipo: mat.tipo,
                quantidade_kg: kg, observacoes: form.observacoes,
                operator_id: user?.id, operator_name: user?.full_name,
                data_lancamento: now, active: true
            });
            await updateBalance(local, mat.id, mat.nome, mat.tipo, -kg, queryClient);
            toast.success(`Saída de ${kg} kg registrada`);
        } else if (modalType === 'transferencia') {
            const bal = balances.find(b => b.material_id === mat.id);
            if (!bal || bal.quantidade_kg < kg) { toast.error('Saldo insuficiente'); setSubmitting(false); return; }
            await Promise.all([
                base44.entities.StockEntry.create({
                    tipo_movimento: 'transferencia_saida',
                    local_origem: local, local_destino: form.destino,
                    material_id: mat.id, material_nome: mat.nome, material_tipo: mat.tipo,
                    quantidade_kg: kg, lote_codigo: form.lote_codigo, observacoes: form.observacoes,
                    operator_id: user?.id, operator_name: user?.full_name,
                    data_lancamento: now, active: true
                }),
                base44.entities.StockEntry.create({
                    tipo_movimento: 'transferencia_entrada',
                    local_origem: local, local_destino: form.destino,
                    material_id: mat.id, material_nome: mat.nome, material_tipo: mat.tipo,
                    quantidade_kg: kg, lote_codigo: form.lote_codigo, observacoes: form.observacoes,
                    operator_id: user?.id, operator_name: user?.full_name,
                    data_lancamento: now, active: true
                })
            ]);
            await updateBalance(local, mat.id, mat.nome, mat.tipo, -kg, queryClient);
            await updateBalance(form.destino, mat.id, mat.nome, mat.tipo, +kg, queryClient);
            toast.success(`Transferência de ${kg} kg: ${local} → ${form.destino}`);
        }

        queryClient.invalidateQueries(['stock-entries', local]);
        queryClient.invalidateQueries(['stock-entries-recent']);
        setShowModal(false);
        setSubmitting(false);
    };

    return (
        <div className="space-y-6 mt-4">
            {/* Header com saldo total */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <Card className="flex-1">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-slate-500 text-sm">Saldo total em {local}</p>
                            <p className="text-3xl font-bold text-slate-900">{totalKg.toFixed(1)} kg</p>
                        </div>
                        <Package className="w-10 h-10 text-slate-300" />
                    </CardContent>
                </Card>
                <div className="flex gap-2 flex-wrap">
                    {allowedEntryTypes.includes('entrada') && (
                        <Button onClick={() => openModal('entrada')} className="bg-emerald-600 hover:bg-emerald-700">
                            <Plus className="w-4 h-4 mr-1" /> Entrada
                        </Button>
                    )}
                    {allowedEntryTypes.includes('saida') && (
                        <Button onClick={() => openModal('saida')} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
                            <TrendingDown className="w-4 h-4 mr-1" /> Saída
                        </Button>
                    )}
                    {transferDestinos.length > 0 && (
                        <Button onClick={() => openModal('transferencia')} className="bg-blue-600 hover:bg-blue-700">
                            <ArrowRight className="w-4 h-4 mr-1" /> Transferir
                        </Button>
                    )}
                </div>
            </div>

            {/* Saldos por material */}
            <Card>
                <CardHeader><CardTitle className="text-base">Saldo por Material</CardTitle></CardHeader>
                <CardContent>
                    {balances.length === 0 ? (
                        <p className="text-slate-400 text-center py-8">Nenhum saldo registrado em {local}</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Material</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead className="text-right">Quantidade (kg)</TableHead>
                                    <TableHead>Atualizado em</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {balances.map(b => (
                                    <TableRow key={b.id} className={b.quantidade_kg <= 0 ? 'opacity-40' : ''}>
                                        <TableCell className="font-medium">{b.material_nome}</TableCell>
                                        <TableCell><Badge variant="outline">{b.material_tipo || '—'}</Badge></TableCell>
                                        <TableCell className="text-right font-bold text-slate-900">{(b.quantidade_kg || 0).toFixed(2)}</TableCell>
                                        <TableCell className="text-slate-400 text-xs">
                                            {b.ultima_atualizacao ? format(new Date(b.ultima_atualizacao), 'dd/MM HH:mm', { locale: ptBR }) : '—'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Histórico */}
            <Card>
                <CardHeader><CardTitle className="text-base">Histórico de Movimentos</CardTitle></CardHeader>
                <CardContent>
                    {entries.length === 0 ? (
                        <p className="text-slate-400 text-center py-8">Nenhum movimento registrado</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Material</TableHead>
                                    <TableHead>Origem → Destino</TableHead>
                                    <TableHead className="text-right">Qtd (kg)</TableHead>
                                    <TableHead>Operador</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries.map(e => {
                                    const cfg = TIPO_LABEL[e.tipo_movimento] || { label: e.tipo_movimento, color: 'bg-slate-100 text-slate-700', sign: '' };
                                    const isPositive = cfg.sign === '+';
                                    return (
                                        <TableRow key={e.id}>
                                            <TableCell className="text-xs text-slate-500">
                                                {format(new Date(e.data_lancamento), 'dd/MM/yy HH:mm', { locale: ptBR })}
                                            </TableCell>
                                            <TableCell><Badge className={cn("text-xs", cfg.color)}>{cfg.label}</Badge></TableCell>
                                            <TableCell className="font-medium">{e.material_nome || '—'}</TableCell>
                                            <TableCell className="text-xs text-slate-500">{e.local_origem} → {e.local_destino || '—'}</TableCell>
                                            <TableCell className={cn("text-right font-bold", isPositive ? 'text-emerald-600' : 'text-red-500')}>
                                                {cfg.sign}{e.quantidade_kg?.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-400">{e.operator_name || '—'}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Modal de lançamento */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {modalType === 'entrada' ? `Nova Entrada — ${local}` : modalType === 'saida' ? `Registrar Saída — ${local}` : `Transferir de ${local}`}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Material *</Label>
                            <Select value={form.material_id} onValueChange={v => setForm(f => ({ ...f, material_id: v }))}>
                                <SelectTrigger><SelectValue placeholder="Selecione o material" /></SelectTrigger>
                                <SelectContent>
                                    {materials.map(m => (
                                        <SelectItem key={m.id} value={m.id}>{m.nome} ({m.tipo})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label>Quantidade (kg) *</Label>
                            <Input type="number" min="0.01" step="0.01" value={form.quantidade_kg}
                                onChange={e => setForm(f => ({ ...f, quantidade_kg: e.target.value }))}
                                placeholder="0.00" />
                        </div>

                        {modalType === 'transferencia' && transferDestinos.length > 1 && (
                            <div className="space-y-1">
                                <Label>Destino *</Label>
                                <Select value={form.destino} onValueChange={v => setForm(f => ({ ...f, destino: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {transferDestinos.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {modalType === 'entrada' && (
                            <>
                                <div className="space-y-1">
                                    <Label>Fornecedor</Label>
                                    <Input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} placeholder="Nome do fornecedor" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label>Nota Fiscal</Label>
                                        <Input value={form.nota_fiscal} onChange={e => setForm(f => ({ ...f, nota_fiscal: e.target.value }))} placeholder="NF-0000" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Lote</Label>
                                        <Input value={form.lote_codigo} onChange={e => setForm(f => ({ ...f, lote_codigo: e.target.value }))} placeholder="LOT-001" />
                                    </div>
                                </div>
                            </>
                        )}

                        {(modalType === 'transferencia') && (
                            <div className="space-y-1">
                                <Label>Lote</Label>
                                <Input value={form.lote_codigo} onChange={e => setForm(f => ({ ...f, lote_codigo: e.target.value }))} placeholder="Código do lote" />
                            </div>
                        )}

                        <div className="space-y-1">
                            <Label>Observações</Label>
                            <Input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Observações..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={submitting}
                            className={modalType === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-700' : modalType === 'transferencia' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}>
                            {submitting ? 'Salvando...' : 'Confirmar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}