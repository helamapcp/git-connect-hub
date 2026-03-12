/**
 * Modal de transferência inteligente PCP → PMP
 * - Seleciona formulação + nº bateladas + misturador
 * - Calcula qtd necessária por MP
 * - Desconta saldo já existente na PMP
 * - Calcula sacos novos a transferir (arredondando para cima)
 * - Sobra dos sacos fica como "crédito" na PMP
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Package, AlertTriangle, CheckCircle2, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { updateBalance } from './StockLocalBase.jsx';

export default function TransferenciaPCPModal({ onClose, onSuccess, balancesPCP, balancesPMP, queryClient, user }) {
    const [formulacaoId, setFormulacaoId] = useState('');
    const [numBateladas, setNumBateladas] = useState(1);
    const [misturador, setMisturador] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const { data: formulacoes = [] } = useQuery({
        queryKey: ['formulacoes'],
        queryFn: () => base44.entities.Formulacao.filter({ ativo: true }),
    });

    const { data: materiais = [] } = useQuery({
        queryKey: ['raw-materials'],
        queryFn: () => base44.entities.RawMaterial.filter({ ativo: true }),
    });

    const formulacao = formulacoes.find(f => f.id === formulacaoId);
    const ingredientes = useMemo(() => {
        if (!formulacao?.ingredientes) return [];
        try { return JSON.parse(formulacao.ingredientes); } catch { return []; }
    }, [formulacao]);

    // Calcula o plano de transferência para cada ingrediente
    const plano = useMemo(() => {
        if (!formulacao || !numBateladas || numBateladas <= 0) return [];
        return ingredientes.map(ing => {
            const mat = materiais.find(m => m.id === ing.material_id);
            const qtdNecessaria = parseFloat((ing.quantidade_kg * numBateladas).toFixed(2));
            const saldoPMP = parseFloat((balancesPMP.find(b => b.material_id === ing.material_id)?.quantidade_kg || 0).toFixed(2));
            const saldoPCP = parseFloat((balancesPCP.find(b => b.material_id === ing.material_id)?.quantidade_kg || 0).toFixed(2));
            const deficit = parseFloat(Math.max(0, qtdNecessaria - saldoPMP).toFixed(2));

            let sacosNovos = 0;
            let qtdTransferida = 0;
            let sobraPMP = 0;

            if (deficit > 0 && mat?.peso_saco_kg) {
                sacosNovos = Math.ceil(deficit / mat.peso_saco_kg);
                qtdTransferida = parseFloat((sacosNovos * mat.peso_saco_kg).toFixed(2));
                sobraPMP = parseFloat((saldoPMP + qtdTransferida - qtdNecessaria).toFixed(2));
            } else if (deficit > 0) {
                // sem peso de saco: transfere exatamente o deficit
                qtdTransferida = deficit;
                sobraPMP = saldoPMP; // não muda
            } else {
                // saldo PMP já cobre
                sobraPMP = parseFloat((saldoPMP - qtdNecessaria).toFixed(2));
            }

            const semEstoque = deficit > 0 && saldoPCP < qtdTransferida;

            return {
                material_id: ing.material_id,
                material_nome: ing.material_nome,
                material_tipo: mat?.tipo || '',
                qtd_necessaria_kg: qtdNecessaria,
                saldo_pmp_kg: saldoPMP,
                saldo_pcp_kg: saldoPCP,
                kg_saco: mat?.peso_saco_kg || null,
                sacos_novos: sacosNovos,
                qtd_transferida_kg: qtdTransferida,
                sobra_pmp_kg: sobraPMP,
                semEstoque,
            };
        });
    }, [formulacao, numBateladas, ingredientes, materiais, balancesPCP, balancesPMP]);

    const temAlerta = plano.some(p => p.semEstoque);
    const totalTransferido = plano.reduce((s, p) => s + p.qtd_transferida_kg, 0);

    const handleConfirmar = async () => {
        if (!formulacaoId || !misturador) { toast.error('Selecione formulação e informe o misturador'); return; }
        if (numBateladas <= 0) { toast.error('Informe o número de bateladas'); return; }
        if (temAlerta) { toast.error('Há materiais com saldo insuficiente no PCP'); return; }

        setSubmitting(true);
        const now = new Date().toISOString();

        // Número sequencial
        const existentes = await base44.entities.TransferenciaPCP.list('-created_date', 1);
        const lastNum = existentes.length > 0
            ? parseInt((existentes[0].numero || 'TPCP-00000').replace('TPCP-', '')) + 1
            : 1;
        const numero = `TPCP-${String(lastNum).padStart(5, '0')}`;

        // Itens apenas com transferência real
        const itensComTransferencia = plano.filter(p => p.qtd_transferida_kg > 0);

        // Criar registro de transferência
        const transferencia = await base44.entities.TransferenciaPCP.create({
            numero,
            formulacao_id: formulacaoId,
            formulacao_nome: formulacao.nome,
            misturador,
            num_bateladas: numBateladas,
            status: 'confirmada',
            itens: JSON.stringify(plano),
            total_transferido_kg: parseFloat(totalTransferido.toFixed(2)),
            observacoes: '',
            operator_id: user?.id,
            operator_name: user?.full_name,
            data_transferencia: now,
            active: true,
        });

        // Movimentar estoque para cada MP com transferência
        for (const item of itensComTransferencia) {
            await Promise.all([
                base44.entities.StockEntry.create({
                    tipo_movimento: 'transferencia_saida',
                    local_origem: 'PCP', local_destino: 'PMP',
                    material_id: item.material_id, material_nome: item.material_nome, material_tipo: item.material_tipo,
                    quantidade_kg: item.qtd_transferida_kg,
                    referencia_id: transferencia.id,
                    observacoes: `Transf. ${numero} — ${numBateladas} batelada(s) de ${formulacao.nome}`,
                    operator_id: user?.id, operator_name: user?.full_name,
                    data_lancamento: now, active: true,
                }),
                base44.entities.StockEntry.create({
                    tipo_movimento: 'transferencia_entrada',
                    local_origem: 'PCP', local_destino: 'PMP',
                    material_id: item.material_id, material_nome: item.material_nome, material_tipo: item.material_tipo,
                    quantidade_kg: item.qtd_transferida_kg,
                    referencia_id: transferencia.id,
                    observacoes: `Transf. ${numero} — ${numBateladas} batelada(s) de ${formulacao.nome}`,
                    operator_id: user?.id, operator_name: user?.full_name,
                    data_lancamento: now, active: true,
                }),
                updateBalance('PCP', item.material_id, item.material_nome, item.material_tipo, -item.qtd_transferida_kg, queryClient),
                updateBalance('PMP', item.material_id, item.material_nome, item.material_tipo, +item.qtd_transferida_kg, queryClient),
            ]);
        }

        // Criar OP de composto automaticamente
        const existentesOP = await base44.entities.OPComposto.list('-created_date', 1);
        const lastNumOP = existentesOP.length > 0
            ? parseInt((existentesOP[0].numero || 'OPC-00000').replace('OPC-', '')) + 1
            : 1;
        const numeroOP = `OPC-${String(lastNumOP).padStart(5, '0')}`;
        const hoje = new Date();
        const batchCode = `${formulacao.material_final.replace(/\s+/g, '-').substring(0, 6).toUpperCase()}-${String(hoje.getFullYear()).slice(2)}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}-${String(lastNumOP).padStart(3, '0')}`;

        await base44.entities.OPComposto.create({
            numero: numeroOP,
            formulacao_id: formulacaoId,
            formulacao_nome: formulacao.nome,
            transferencia_id: transferencia.id,
            misturador,
            num_bateladas_planejadas: numBateladas,
            num_bateladas_realizadas: 0,
            status: 'aberta',
            total_composto_kg: 0,
            num_bags: 0,
            batch_code: batchCode,
            data_abertura: now,
            operator_id: user?.id,
            operator_name: user?.full_name,
            active: true,
        });

        queryClient.invalidateQueries(['stock-balances']);
        queryClient.invalidateQueries(['stock-entries']);
        queryClient.invalidateQueries(['transferencias-pcp']);
        queryClient.invalidateQueries(['ops-composto']);

        toast.success(`${numero} confirmada! OP ${numeroOP} criada na PMP.`);
        onSuccess?.();
        onClose();
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRight className="w-5 h-5 text-indigo-600" />
                        Transferência PCP → PMP por Formulação
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Seleção */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-1">
                            <Label>Formulação *</Label>
                            <Select value={formulacaoId} onValueChange={setFormulacaoId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecionar formulação..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {formulacoes.map(f => (
                                        <SelectItem key={f.id} value={f.id}>
                                            {f.nome} — {f.material_final} ({f.peso_batelada_kg} kg/bat.)
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Nº Bateladas *</Label>
                            <Input
                                type="number" min="1" step="1"
                                value={numBateladas}
                                onChange={e => setNumBateladas(Math.max(1, parseInt(e.target.value) || 1))}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label>Misturador *</Label>
                        <Input
                            value={misturador}
                            onChange={e => setMisturador(e.target.value)}
                            placeholder="Ex: MIS-01"
                        />
                    </div>

                    {/* Resumo da formulação */}
                    {formulacao && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                            <FlaskConical className="w-5 h-5 text-amber-600 shrink-0" />
                            <div className="text-sm">
                                <span className="font-semibold text-amber-800">{formulacao.nome}</span>
                                <span className="text-amber-600"> → {formulacao.material_final}</span>
                                <span className="text-amber-500 ml-2">| {formulacao.peso_batelada_kg} kg × {numBateladas} bat. = <strong>{(formulacao.peso_batelada_kg * numBateladas).toFixed(2)} kg</strong></span>
                            </div>
                        </div>
                    )}

                    {/* Plano de transferência */}
                    {plano.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-base font-semibold">Plano de Transferência por Material</Label>
                            <div className="rounded-xl border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead>Material</TableHead>
                                            <TableHead className="text-right">Necessário</TableHead>
                                            <TableHead className="text-right">Saldo PMP</TableHead>
                                            <TableHead className="text-right">Sacos novos</TableHead>
                                            <TableHead className="text-right">A transferir</TableHead>
                                            <TableHead className="text-right">Sobra PMP</TableHead>
                                            <TableHead className="text-right">Saldo PCP</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {plano.map((item, idx) => (
                                            <TableRow key={idx} className={item.semEstoque ? 'bg-red-50' : item.qtd_transferida_kg === 0 ? 'bg-emerald-50' : ''}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        {item.semEstoque && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                                                        {!item.semEstoque && item.qtd_transferida_kg === 0 && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                                                        {item.material_nome}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">{item.qtd_necessaria_kg.toFixed(2)} kg</TableCell>
                                                <TableCell className="text-right text-slate-500">{item.saldo_pmp_kg.toFixed(2)} kg</TableCell>
                                                <TableCell className="text-right">
                                                    {item.sacos_novos > 0
                                                        ? <Badge variant="outline">{item.sacos_novos} × {item.kg_saco} kg</Badge>
                                                        : <span className="text-emerald-600 text-xs">cobert. pelo saldo</span>}
                                                </TableCell>
                                                <TableCell className={cn("text-right font-bold", item.qtd_transferida_kg > 0 ? 'text-blue-700' : 'text-emerald-600')}>
                                                    {item.qtd_transferida_kg > 0 ? `${item.qtd_transferida_kg.toFixed(2)} kg` : '—'}
                                                </TableCell>
                                                <TableCell className="text-right text-slate-500">{item.sobra_pmp_kg.toFixed(2)} kg</TableCell>
                                                <TableCell className={cn("text-right text-xs", item.semEstoque ? 'text-red-600 font-bold' : 'text-slate-500')}>
                                                    {item.saldo_pcp_kg.toFixed(2)} kg
                                                    {item.semEstoque && ' ⚠'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {temAlerta && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    Há materiais com saldo insuficiente no PCP. Solicite reposição ao CD antes de confirmar.
                                </div>
                            )}

                            {!temAlerta && totalTransferido > 0 && (
                                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
                                    <Package className="w-4 h-4 shrink-0" />
                                    Total a transferir: <strong>{totalTransferido.toFixed(2)} kg</strong> do PCP para PMP.
                                    Uma OP será criada automaticamente na PMP.
                                </div>
                            )}

                            {!temAlerta && totalTransferido === 0 && (
                                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    Saldo atual da PMP já cobre todas as bateladas. Nenhuma transferência física necessária.
                                    Uma OP será criada automaticamente.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={handleConfirmar}
                        disabled={submitting || !formulacaoId || !misturador || temAlerta}
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        {submitting ? 'Processando...' : 'Confirmar Transferência'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}