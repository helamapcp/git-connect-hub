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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, FlaskConical, Package, Trash2, CheckCircle2, ArrowRight, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { updateBalance } from './StockLocalBase.jsx';
import StockLocalBase from './StockLocalBase.jsx';
import OPCompostoPanel from './OPCompostoPanel.jsx';

function gerarBatchCode(numero) {
    const hoje = new Date();
    const data = format(hoje, 'yyyyMMdd');
    return `MX01-CMP-${data}-${String(numero).padStart(3, '0')}`;
}

export default function EstoquePMP() {
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Formulário de produção de composto
    const [form, setForm] = useState({
        data_producao: format(new Date(), 'yyyy-MM-dd'),
        total_composto_kg: '',
        num_sacolas: '',
        observacoes: '',
        materias_primas: [{ material_id: '', material_nome: '', material_tipo: '', quantidade_kg: '' }]
    });

    useEffect(() => { base44.auth.me().then(setUser).catch(() => { }); }, []);

    const { data: materials = [] } = useQuery({
        queryKey: ['raw-materials'],
        queryFn: () => base44.entities.RawMaterial.filter({ ativo: true })
    });

    const { data: balancesPMP = [] } = useQuery({
        queryKey: ['stock-balances', 'PMP'],
        queryFn: async () => {
            const all = await base44.entities.StockBalance.list();
            return all.filter(b => b.local === 'PMP');
        },
        refetchInterval: 15000
    });

    const { data: compostos = [] } = useQuery({
        queryKey: ['compostos-producao'],
        queryFn: () => base44.entities.CompostoProducao.list('-created_date', 50),
        refetchInterval: 15000
    });

    const totalMPDisponivel = balancesPMP.reduce((s, b) => s + (b.quantidade_kg || 0), 0);

    const totalMPForm = form.materias_primas.reduce((s, mp) => s + (parseFloat(mp.quantidade_kg) || 0), 0);
    const rendimento = form.total_composto_kg && totalMPForm > 0
        ? ((parseFloat(form.total_composto_kg) / totalMPForm) * 100).toFixed(1)
        : null;

    const addMP = () => setForm(f => ({
        ...f,
        materias_primas: [...f.materias_primas, { material_id: '', material_nome: '', material_tipo: '', quantidade_kg: '' }]
    }));

    const removeMP = (idx) => setForm(f => ({
        ...f,
        materias_primas: f.materias_primas.filter((_, i) => i !== idx)
    }));

    const updateMP = (idx, field, value) => {
        setForm(f => {
            const mps = [...f.materias_primas];
            if (field === 'material_id') {
                const mat = materials.find(m => m.id === value);
                mps[idx] = { ...mps[idx], material_id: value, material_nome: mat?.nome || '', material_tipo: mat?.tipo || '' };
            } else {
                mps[idx] = { ...mps[idx], [field]: value };
            }
            return { ...f, materias_primas: mps };
        });
    };

    const handleSubmit = async () => {
        // Validações
        const mpsValidas = form.materias_primas.filter(mp => mp.material_id && parseFloat(mp.quantidade_kg) > 0);
        if (mpsValidas.length === 0) { toast.error('Adicione ao menos uma matéria-prima'); return; }
        if (!form.total_composto_kg || parseFloat(form.total_composto_kg) <= 0) { toast.error('Informe o total de composto produzido'); return; }
        if (!form.num_sacolas || parseInt(form.num_sacolas) <= 0) { toast.error('Informe o número de sacolas'); return; }

        // Verificar saldo de cada MP
        for (const mp of mpsValidas) {
            const bal = balancesPMP.find(b => b.material_id === mp.material_id);
            const disponivel = bal?.quantidade_kg || 0;
            if (parseFloat(mp.quantidade_kg) > disponivel) {
                toast.error(`Saldo insuficiente de "${mp.material_nome}": ${disponivel.toFixed(2)} kg disponíveis`);
                return;
            }
        }

        setSubmitting(true);
        const now = new Date().toISOString();
        const totalMP = mpsValidas.reduce((s, mp) => s + parseFloat(mp.quantidade_kg), 0);
        const totalComposto = parseFloat(form.total_composto_kg);
        const numSacolas = parseInt(form.num_sacolas);
        const pesoMedio = totalComposto / numSacolas;

        // Gerar número sequencial
        const existentes = await base44.entities.CompostoProducao.list('-created_date', 1);
        const lastNum = existentes.length > 0
            ? parseInt((existentes[0].numero || 'COMP-00000').replace('COMP-', '')) + 1
            : 1;
        const numero = `COMP-${String(lastNum).padStart(5, '0')}`;
        const batchCode = gerarBatchCode(lastNum);

        // Criar registro de produção de composto
        const composto = await base44.entities.CompostoProducao.create({
            numero,
            batch_code: batchCode,
            status: 'finalizado',
            data_producao: form.data_producao,
            materias_primas: JSON.stringify(mpsValidas),
            total_mp_kg: totalMP,
            total_composto_kg: totalComposto,
            rendimento_pct: parseFloat(rendimento) || null,
            num_sacolas: numSacolas,
            peso_medio_sacola_kg: pesoMedio,
            observacoes: form.observacoes,
            operator_id: user?.id,
            operator_name: user?.full_name,
            active: true
        });

        // Descontar MP da PMP
        await Promise.all(mpsValidas.map(mp =>
            updateBalance('PMP', mp.material_id, mp.material_nome, mp.material_tipo, -parseFloat(mp.quantidade_kg), queryClient)
        ));

        // Registrar saída de MP da PMP
        await Promise.all(mpsValidas.map(mp =>
            base44.entities.StockEntry.create({
                tipo_movimento: 'saida',
                local_origem: 'PMP', local_destino: 'PMP',
                material_id: mp.material_id, material_nome: mp.material_nome, material_tipo: mp.material_tipo,
                quantidade_kg: parseFloat(mp.quantidade_kg),
                referencia_id: composto.id,
                observacoes: `Produção composto ${numero}`,
                operator_id: user?.id, operator_name: user?.full_name,
                data_lancamento: now, active: true
            })
        ));

        // Criar sacolas de ProductionBag
        const sacolas = Array.from({ length: numSacolas }, (_, i) => ({
            batch_code: batchCode,
            bag_number: i + 1,
            weight_kg: pesoMedio,
            remaining_kg: pesoMedio,
            location_code: 'PMP',
            status: 'stored',
            operator_id: user?.id,
            operator_name: user?.full_name,
            active: true
        }));
        await base44.entities.ProductionBag.bulkCreate(sacolas);

        // StockMovement de saída PMP (composto gerado)
        await base44.entities.StockMovement.create({
            batch_code: batchCode,
            location_code: 'PMP',
            movement_type: 'production_output',
            total_kg: totalComposto,
            reference_id: composto.id,
            operator_id: user?.id,
            operator_name: user?.full_name,
            timestamp: now,
            notes: `Produção: ${numero}`
        });

        queryClient.invalidateQueries(['compostos-producao']);
        queryClient.invalidateQueries(['stock-balances', 'PMP']);
        queryClient.invalidateQueries(['transfer-bags-pmp']);
        queryClient.invalidateQueries(['factory-bags']);

        toast.success(`${numero} registrado! ${numSacolas} sacolas de ${pesoMedio.toFixed(2)} kg criadas no PMP`);
        setShowModal(false);
        setForm({
            data_producao: format(new Date(), 'yyyy-MM-dd'),
            total_composto_kg: '', num_sacolas: '', observacoes: '',
            materias_primas: [{ material_id: '', material_nome: '', material_tipo: '', quantidade_kg: '' }]
        });
        setSubmitting(false);
    };

    return (
        <div className="space-y-4 mt-4">
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <FlaskConical className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-amber-700 text-sm">
                    <strong>PMP — Preparação de Matéria-Prima:</strong> A MP entra como matéria-prima e sai transformada em <strong>composto</strong> (sacolas). As sacolas são enviadas para a Fábrica.
                </p>
            </div>

            <Tabs defaultValue="ops">
                <TabsList>
                    <TabsTrigger value="ops" className="flex items-center gap-1">
                        <ClipboardList className="w-4 h-4" /> OPs de Composto
                    </TabsTrigger>
                    <TabsTrigger value="estoque">Estoque de MP</TabsTrigger>
                    <TabsTrigger value="compostos">Histórico de Produção</TabsTrigger>
                </TabsList>

                {/* OPs geradas pelo PCP */}
                <TabsContent value="ops">
                    <div className="mt-4">
                        <OPCompostoPanel />
                    </div>
                </TabsContent>

                {/* Aba de estoque de MP — usa o base */}
                <TabsContent value="estoque">
                    <StockLocalBase
                        local="PMP"
                        allowedEntryTypes={['saida']}
                        transferDestinos={[]}
                    />
                </TabsContent>

                {/* Aba de histórico de produção de composto */}
                <TabsContent value="compostos">
                    <div className="space-y-4 mt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-slate-500 text-sm">MP disponível na PMP</p>
                                <p className="text-2xl font-bold text-slate-900">{totalMPDisponivel.toFixed(1)} kg</p>
                            </div>
                            <Button onClick={() => setShowModal(true)} className="bg-amber-600 hover:bg-amber-700">
                                <Plus className="w-4 h-4 mr-1" /> Nova Produção de Composto
                            </Button>
                        </div>

                        {/* Lista de produções */}
                        {compostos.length === 0 ? (
                            <Card>
                                <CardContent className="p-12 text-center">
                                    <FlaskConical className="w-14 h-14 mx-auto mb-4 text-slate-300" />
                                    <p className="text-slate-500 text-lg">Nenhuma produção de composto registrada</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {compostos.map(c => {
                                    const mps = (() => { try { return JSON.parse(c.materias_primas || '[]'); } catch { return []; } })();
                                    return (
                                        <Card key={c.id}>
                                            <CardContent className="p-4">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-slate-900">{c.numero}</p>
                                                            <Badge className="bg-violet-100 text-violet-700 font-mono text-xs">{c.batch_code}</Badge>
                                                            <Badge className={c.status === 'finalizado' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                                                                {c.status}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-slate-500 text-xs mt-1">
                                                            {format(new Date(c.data_producao + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })} • {c.operator_name || '—'}
                                                        </p>
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {mps.map((mp, i) => (
                                                                <span key={i} className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5">
                                                                    {mp.material_nome}: {parseFloat(mp.quantidade_kg).toFixed(1)} kg
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-6 text-center shrink-0">
                                                        <div>
                                                            <p className="text-slate-400 text-xs">MP Consumida</p>
                                                            <p className="font-bold text-slate-800">{(c.total_mp_kg || 0).toFixed(1)} kg</p>
                                                        </div>
                                                        <div className="text-slate-300 self-center"><ArrowRight className="w-4 h-4" /></div>
                                                        <div>
                                                            <p className="text-slate-400 text-xs">Composto</p>
                                                            <p className="font-bold text-emerald-700">{(c.total_composto_kg || 0).toFixed(1)} kg</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-slate-400 text-xs">Sacolas</p>
                                                            <p className="font-bold text-blue-700">{c.num_sacolas}</p>
                                                        </div>
                                                        {c.rendimento_pct && (
                                                            <div>
                                                                <p className="text-slate-400 text-xs">Rendimento</p>
                                                                <p className={cn("font-bold", c.rendimento_pct >= 95 ? 'text-emerald-600' : c.rendimento_pct >= 85 ? 'text-amber-600' : 'text-red-500')}>
                                                                    {c.rendimento_pct}%
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Modal de produção de composto */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FlaskConical className="w-5 h-5 text-amber-600" /> Nova Produção de Composto — PMP
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        <div className="space-y-1">
                            <Label>Data da Produção *</Label>
                            <Input type="date" value={form.data_producao}
                                onChange={e => setForm(f => ({ ...f, data_producao: e.target.value }))} />
                        </div>

                        {/* Matérias-primas consumidas */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-base font-semibold">Matérias-Primas Consumidas</Label>
                                <Button type="button" variant="outline" size="sm" onClick={addMP}>
                                    <Plus className="w-3 h-3 mr-1" /> Adicionar MP
                                </Button>
                            </div>

                            {form.materias_primas.map((mp, idx) => (
                                <div key={idx} className="grid grid-cols-[1fr_120px_36px] gap-2 items-end">
                                    <div className="space-y-1">
                                        {idx === 0 && <Label className="text-xs text-slate-500">Material</Label>}
                                        <Select value={mp.material_id} onValueChange={v => updateMP(idx, 'material_id', v)}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>
                                                {materials.map(m => {
                                                    const bal = balancesPMP.find(b => b.material_id === m.id);
                                                    return (
                                                        <SelectItem key={m.id} value={m.id}>
                                                            {m.nome} — {(bal?.quantidade_kg || 0).toFixed(1)} kg disp.
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        {idx === 0 && <Label className="text-xs text-slate-500">Qtd (kg)</Label>}
                                        <Input type="number" min="0.01" step="0.01" placeholder="0.00"
                                            value={mp.quantidade_kg}
                                            onChange={e => updateMP(idx, 'quantidade_kg', e.target.value)} />
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50"
                                        onClick={() => removeMP(idx)} disabled={form.materias_primas.length === 1}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}

                            <div className="flex justify-between p-2 bg-slate-50 rounded-lg text-sm">
                                <span className="text-slate-600">Total de MP:</span>
                                <span className="font-bold">{totalMPForm.toFixed(2)} kg</span>
                            </div>
                        </div>

                        {/* Composto produzido */}
                        <div className="border-t pt-4 space-y-3">
                            <Label className="text-base font-semibold">Composto Produzido</Label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label>Total de Composto (kg) *</Label>
                                    <Input type="number" min="0.01" step="0.01" placeholder="0.00"
                                        value={form.total_composto_kg}
                                        onChange={e => setForm(f => ({ ...f, total_composto_kg: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                    <Label>Número de Sacolas *</Label>
                                    <Input type="number" min="1" step="1" placeholder="0"
                                        value={form.num_sacolas}
                                        onChange={e => setForm(f => ({ ...f, num_sacolas: e.target.value }))} />
                                </div>
                            </div>

                            {/* Preview */}
                            {form.total_composto_kg && form.num_sacolas && (
                                <div className="grid grid-cols-3 gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                                    <div>
                                        <p className="text-amber-600 text-xs">Peso médio/sacola</p>
                                        <p className="font-bold text-amber-800">{(parseFloat(form.total_composto_kg) / parseInt(form.num_sacolas)).toFixed(2)} kg</p>
                                    </div>
                                    <div>
                                        <p className="text-amber-600 text-xs">Rendimento</p>
                                        <p className={cn("font-bold", rendimento >= 95 ? 'text-emerald-600' : rendimento >= 85 ? 'text-amber-700' : 'text-red-500')}>
                                            {rendimento}%
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-amber-600 text-xs">Perda</p>
                                        <p className="font-bold text-red-500">{Math.max(0, totalMPForm - parseFloat(form.total_composto_kg || 0)).toFixed(2)} kg</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label>Observações</Label>
                            <Input value={form.observacoes}
                                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                                placeholder="Observações sobre a produção..." />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={submitting} className="bg-amber-600 hover:bg-amber-700">
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            {submitting ? 'Registrando...' : 'Finalizar Produção'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}