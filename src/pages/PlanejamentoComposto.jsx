import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, FlaskConical, Scale, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

function IngredienteRow({ ingrediente, materiais, onChange, onRemove }) {
    const mat = materiais.find(m => m.id === ingrediente.material_id);
    const sacosNecessarios = mat?.peso_saco_kg && ingrediente.quantidade_kg
        ? Math.ceil(ingrediente.quantidade_kg / mat.peso_saco_kg)
        : null;

    return (
        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
            <div className="flex-1">
                <Select
                    value={ingrediente.material_id}
                    onValueChange={v => {
                        const m = materiais.find(x => x.id === v);
                        onChange({ ...ingrediente, material_id: v, material_nome: m?.nome || '' });
                    }}
                >
                    <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecionar matéria-prima..." />
                    </SelectTrigger>
                    <SelectContent>
                        {materiais.map(m => (
                            <SelectItem key={m.id} value={m.id}>
                                {m.codigo} — {m.nome}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="w-36">
                <Input
                    type="number"
                    placeholder="Qtd (kg)"
                    value={ingrediente.quantidade_kg || ''}
                    onChange={e => onChange({ ...ingrediente, quantidade_kg: parseFloat(e.target.value) || 0 })}
                    className="bg-white"
                />
            </div>
            {sacosNecessarios && (
                <div className="text-xs text-slate-500 whitespace-nowrap">
                    ≈ {sacosNecessarios} saco{sacosNecessarios > 1 ? 's' : ''}
                </div>
            )}
            <Button variant="ghost" size="icon" onClick={onRemove} className="text-red-500 shrink-0">
                <Trash2 className="w-4 h-4" />
            </Button>
        </div>
    );
}

function FormulacaoModal({ formulacao, materiais, onSave, onClose }) {
    const [form, setForm] = useState({
        nome: formulacao?.nome || '',
        material_final: formulacao?.material_final || '',
        peso_batelada_kg: formulacao?.peso_batelada_kg || '',
        observacoes: formulacao?.observacoes || '',
        ativo: formulacao?.ativo !== false,
    });

    const [ingredientes, setIngredientes] = useState(() => {
        if (!formulacao?.ingredientes) return [];
        try { return JSON.parse(formulacao.ingredientes); } catch { return []; }
    });

    const totalIngredientes = ingredientes.reduce((s, i) => s + (i.quantidade_kg || 0), 0);
    const diff = parseFloat(form.peso_batelada_kg || 0) - totalIngredientes;

    const addIngrediente = () => {
        setIngredientes(prev => [...prev, { material_id: '', material_nome: '', quantidade_kg: 0 }]);
    };

    const updateIngrediente = (idx, val) => {
        setIngredientes(prev => prev.map((x, i) => i === idx ? val : x));
    };

    const removeIngrediente = (idx) => {
        setIngredientes(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSave = () => {
        if (!form.nome || !form.material_final || !form.peso_batelada_kg) {
            toast.error('Preencha nome, material final e peso da batelada');
            return;
        }
        const valid = ingredientes.filter(i => i.material_id && i.quantidade_kg > 0);
        onSave({ ...form, peso_batelada_kg: parseFloat(form.peso_batelada_kg), ingredientes: JSON.stringify(valid) });
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FlaskConical className="w-5 h-5 text-amber-600" />
                        {formulacao ? 'Editar Formulação' : 'Nova Formulação'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Dados básicos */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label>Nome da Formulação *</Label>
                            <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Formula A" />
                        </div>
                        <div className="space-y-1">
                            <Label>Material Final *</Label>
                            <Input value={form.material_final} onChange={e => setForm(p => ({ ...p, material_final: e.target.value }))} placeholder="Composto PVC Cinza" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label>Peso Total por Batelada (kg) *</Label>
                        <Input type="number" value={form.peso_batelada_kg} onChange={e => setForm(p => ({ ...p, peso_batelada_kg: e.target.value }))} placeholder="500" />
                    </div>

                    {/* Ingredientes */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-base font-semibold">Matérias-Primas por Batelada</Label>
                            <Button variant="outline" size="sm" onClick={addIngrediente}>
                                <Plus className="w-4 h-4 mr-1" /> Adicionar
                            </Button>
                        </div>

                        {ingredientes.length === 0 && (
                            <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed rounded-lg">
                                Nenhuma matéria-prima adicionada
                            </div>
                        )}

                        <div className="space-y-2">
                            {ingredientes.map((ing, idx) => (
                                <IngredienteRow
                                    key={idx}
                                    ingrediente={ing}
                                    materiais={materiais}
                                    onChange={val => updateIngrediente(idx, val)}
                                    onRemove={() => removeIngrediente(idx)}
                                />
                            ))}
                        </div>

                        {/* Resumo de peso */}
                        {ingredientes.length > 0 && (
                            <div className={`flex items-center justify-between p-3 rounded-lg text-sm font-medium ${Math.abs(diff) < 0.01 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                <span className="flex items-center gap-2">
                                    <Scale className="w-4 h-4" />
                                    Total ingredientes: <strong>{totalIngredientes.toFixed(2)} kg</strong>
                                </span>
                                <span>
                                    {Math.abs(diff) < 0.01 ? '✓ Batelada balanceada' : `Diferença: ${diff > 0 ? '+' : ''}${diff.toFixed(2)} kg`}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <Label>Observações</Label>
                        <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Instruções, cuidados, etc." />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} className="bg-amber-600 hover:bg-amber-700">
                        {formulacao ? 'Salvar Alterações' : 'Criar Formulação'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function FormulacaoCard({ formulacao, materiais, onEdit, onDelete }) {
    const [expanded, setExpanded] = useState(false);
    const ingredientes = (() => { try { return JSON.parse(formulacao.ingredientes || '[]'); } catch { return []; } })();

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <FlaskConical className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900">{formulacao.nome}</h3>
                            <p className="text-sm text-slate-500">{formulacao.material_final}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-700">
                            <Scale className="w-3 h-3 mr-1" />
                            {formulacao.peso_batelada_kg} kg/batelada
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={() => onEdit(formulacao)}>
                            <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => onDelete(formulacao.id)}>
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            {ingredientes.length > 0 && (
                <>
                    <div
                        className="px-6 pb-3 flex items-center gap-2 cursor-pointer text-sm text-slate-500 hover:text-slate-700"
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {ingredientes.length} matéria{ingredientes.length > 1 ? 's-primas' : '-prima'}
                    </div>
                    {expanded && (
                        <CardContent className="pt-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Matéria-Prima</TableHead>
                                        <TableHead className="text-right">Qtd (kg)</TableHead>
                                        <TableHead className="text-right">% Batelada</TableHead>
                                        <TableHead className="text-right">Nº Sacos</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {ingredientes.map((ing, idx) => {
                                        const mat = materiais.find(m => m.id === ing.material_id);
                                        const pct = formulacao.peso_batelada_kg > 0
                                            ? ((ing.quantidade_kg / formulacao.peso_batelada_kg) * 100).toFixed(1)
                                            : '-';
                                        const sacos = mat?.peso_saco_kg ? Math.ceil(ing.quantidade_kg / mat.peso_saco_kg) : '-';
                                        return (
                                            <TableRow key={idx}>
                                                <TableCell className="font-medium">{ing.material_nome}</TableCell>
                                                <TableCell className="text-right">{ing.quantidade_kg}</TableCell>
                                                <TableCell className="text-right text-slate-500">{pct}%</TableCell>
                                                <TableCell className="text-right">
                                                    {sacos !== '-'
                                                        ? <Badge variant="outline">{sacos} saco{sacos > 1 ? 's' : ''}</Badge>
                                                        : <span className="text-slate-400 text-xs">—</span>}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                            {formulacao.observacoes && (
                                <p className="mt-3 text-sm text-slate-500 italic">{formulacao.observacoes}</p>
                            )}
                        </CardContent>
                    )}
                </>
            )}
        </Card>
    );
}

export default function PlanejamentoComposto() {
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [editingFormulacao, setEditingFormulacao] = useState(null);
    const [search, setSearch] = useState('');

    const { data: formulacoes = [], isLoading } = useQuery({
        queryKey: ['formulacoes'],
        queryFn: () => base44.entities.Formulacao.filter({ ativo: true }),
    });

    const { data: materiais = [] } = useQuery({
        queryKey: ['raw-materials-active'],
        queryFn: () => base44.entities.RawMaterial.filter({ ativo: true }),
    });

    const saveFormulacao = useMutation({
        mutationFn: (data) => editingFormulacao
            ? base44.entities.Formulacao.update(editingFormulacao.id, data)
            : base44.entities.Formulacao.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['formulacoes']);
            setShowModal(false);
            setEditingFormulacao(null);
            toast.success('Formulação salva!');
        }
    });

    const deleteFormulacao = useMutation({
        mutationFn: (id) => base44.entities.Formulacao.update(id, { ativo: false }),
        onSuccess: () => {
            queryClient.invalidateQueries(['formulacoes']);
            toast.success('Formulação removida!');
        }
    });

    const filtered = formulacoes.filter(f =>
        f.nome?.toLowerCase().includes(search.toLowerCase()) ||
        f.material_final?.toLowerCase().includes(search.toLowerCase())
    );

    const handleEdit = (f) => {
        setEditingFormulacao(f);
        setShowModal(true);
    };

    const handleNew = () => {
        setEditingFormulacao(null);
        setShowModal(true);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <FlaskConical className="w-6 h-6 text-amber-600" />
                            Planejamento de Composto
                        </h1>
                        <p className="text-slate-500 mt-0.5">Gerencie as formulações de composto PVC</p>
                    </div>
                    <Button onClick={handleNew} className="bg-amber-600 hover:bg-amber-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Formulação
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-5">
                            <p className="text-sm text-slate-500">Formulações ativas</p>
                            <p className="text-3xl font-bold text-slate-900">{formulacoes.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-5">
                            <p className="text-sm text-slate-500">Matérias-primas</p>
                            <p className="text-3xl font-bold text-slate-900">{materiais.length}</p>
                        </CardContent>
                    </Card>
                    <Card className="col-span-2 md:col-span-1">
                        <CardContent className="pt-5">
                            <p className="text-sm text-slate-500">Peso médio batelada</p>
                            <p className="text-3xl font-bold text-slate-900">
                                {formulacoes.length > 0
                                    ? (formulacoes.reduce((s, f) => s + (f.peso_batelada_kg || 0), 0) / formulacoes.length).toFixed(0)
                                    : '—'} kg
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <Input
                    placeholder="Buscar por nome ou material final..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="bg-white"
                />

                {/* Lista */}
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <Card>
                        <CardContent className="py-16 text-center text-slate-400">
                            <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">Nenhuma formulação encontrada</p>
                            <p className="text-sm mt-1">Clique em "Nova Formulação" para começar</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(f => (
                            <FormulacaoCard
                                key={f.id}
                                formulacao={f}
                                materiais={materiais}
                                onEdit={handleEdit}
                                onDelete={(id) => deleteFormulacao.mutate(id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {showModal && (
                <FormulacaoModal
                    formulacao={editingFormulacao}
                    materiais={materiais}
                    onSave={(data) => saveFormulacao.mutate(data)}
                    onClose={() => { setShowModal(false); setEditingFormulacao(null); }}
                />
            )}
        </div>
    );
}