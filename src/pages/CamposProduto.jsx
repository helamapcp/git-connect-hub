import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Settings, ToggleLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TIPO_DADO_LABEL = { string: 'Texto', number: 'Número', select: 'Lista', boolean: 'Sim/Não' };
const CATEGORIAS = ['TELHA', 'FORRO', 'CUMEEIRA', 'PORTA', 'ACABAMENTO'];

function CampoForm({ campo, onSave, onCancel }) {
    const [form, setForm] = useState(campo || {
        nome_campo: '', label: '', tipo_dado: 'string',
        obrigatorio: false, opcoes_select: '', categoria_aplicavel: '', ordem: 0, ativo: true
    });

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label>Nome interno *</Label>
                    <Input value={form.nome_campo} onChange={e => setForm(p => ({ ...p, nome_campo: e.target.value }))}
                        placeholder="peso_unitario" disabled={!!campo} />
                    {!campo && <p className="text-xs text-slate-400">Sem espaços ou acentos</p>}
                </div>
                <div className="space-y-1">
                    <Label>Rótulo exibido *</Label>
                    <Input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                        placeholder="Peso Unitário" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label>Tipo de dado</Label>
                    <Select value={form.tipo_dado} onValueChange={v => setForm(p => ({ ...p, tipo_dado: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="string">Texto</SelectItem>
                            <SelectItem value="number">Número</SelectItem>
                            <SelectItem value="select">Lista de opções</SelectItem>
                            <SelectItem value="boolean">Sim/Não</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label>Categoria aplicável</Label>
                    <Select value={form.categoria_aplicavel || ''} onValueChange={v => setForm(p => ({ ...p, categoria_aplicavel: v }))}>
                        <SelectTrigger><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={null}>Todas as categorias</SelectItem>
                            {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {form.tipo_dado === 'select' && (
                <div className="space-y-1">
                    <Label>Opções (JSON array)</Label>
                    <Input value={form.opcoes_select} onChange={e => setForm(p => ({ ...p, opcoes_select: e.target.value }))}
                        placeholder='["Opção 1", "Opção 2"]' />
                    <p className="text-xs text-slate-400">Formato: ["op1", "op2", "op3"]</p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label>Ordem de exibição</Label>
                    <Input type="number" value={form.ordem}
                        onChange={e => setForm(p => ({ ...p, ordem: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="flex items-center gap-3 pt-6">
                    <Switch checked={form.obrigatorio} onCheckedChange={v => setForm(p => ({ ...p, obrigatorio: v }))} />
                    <Label>Campo obrigatório</Label>
                </div>
            </div>

            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                <Button onClick={() => onSave(form)} disabled={!form.nome_campo || !form.label}>Salvar</Button>
            </DialogFooter>
        </div>
    );
}

export default function CamposProduto() {
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [editingCampo, setEditingCampo] = useState(null);
    const [showInactive, setShowInactive] = useState(false);

    const { data: campos = [], isLoading } = useQuery({
        queryKey: ['produto-campos-admin', showInactive],
        queryFn: () => showInactive ? base44.entities.ProdutoCampo.list() : base44.entities.ProdutoCampo.filter({ ativo: true })
    });

    const saveCampo = useMutation({
        mutationFn: (data) => editingCampo
            ? base44.entities.ProdutoCampo.update(editingCampo.id, data)
            : base44.entities.ProdutoCampo.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['produto-campos-admin']);
            queryClient.invalidateQueries(['produto-campos']);
            // Log de auditoria
            base44.entities.AuditLog.create({
                entity_type: 'ProdutoCampo',
                entity_id: editingCampo?.id || 'new',
                action: editingCampo ? 'update' : 'create',
                user_id: 'admin',
                user_name: 'Admin',
                timestamp: new Date().toISOString()
            }).catch(() => { });
            setShowModal(false);
            setEditingCampo(null);
            toast.success('Campo salvo!');
        }
    });

    const toggleAtivo = useMutation({
        mutationFn: ({ id, ativo }) => {
            // Log auditoria
            base44.entities.AuditLog.create({
                entity_type: 'ProdutoCampo',
                entity_id: id,
                action: 'update',
                user_id: 'admin',
                user_name: 'Admin',
                changes: { ativo },
                timestamp: new Date().toISOString()
            }).catch(() => { });
            return base44.entities.ProdutoCampo.update(id, { ativo });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['produto-campos-admin']);
            queryClient.invalidateQueries(['produto-campos']);
            toast.success('Status atualizado!');
        }
    });

    const sorted = [...campos].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Settings className="w-6 h-6 text-blue-600" />
                            Configuração de Campos de Produto
                        </h1>
                        <p className="text-slate-500">Gerencie os campos dinâmicos exibidos no cadastro de produtos</p>
                    </div>
                    <Button onClick={() => { setEditingCampo(null); setShowModal(true); }} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />Novo Campo
                    </Button>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Switch checked={showInactive} onCheckedChange={setShowInactive} />
                    Mostrar campos inativos
                </div>

                <Card>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ordem</TableHead>
                                    <TableHead>Nome interno</TableHead>
                                    <TableHead>Rótulo</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Categoria</TableHead>
                                    <TableHead>Obrigatório</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array(3).fill(0).map((_, i) => (
                                        <TableRow key={i}>{Array(8).fill(0).map((_, j) => (
                                            <TableCell key={j}><div className="h-4 bg-slate-200 rounded animate-pulse w-16" /></TableCell>
                                        ))}</TableRow>
                                    ))
                                ) : sorted.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                                            Nenhum campo cadastrado
                                        </TableCell>
                                    </TableRow>
                                ) : sorted.map(campo => (
                                    <TableRow key={campo.id} className={!campo.ativo ? 'opacity-50' : ''}>
                                        <TableCell className="text-slate-500">{campo.ordem || 0}</TableCell>
                                        <TableCell className="font-mono text-xs">{campo.nome_campo}</TableCell>
                                        <TableCell className="font-medium">{campo.label}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{TIPO_DADO_LABEL[campo.tipo_dado]}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {campo.categoria_aplicavel
                                                ? <Badge className="bg-blue-100 text-blue-700 text-xs">{campo.categoria_aplicavel}</Badge>
                                                : <span className="text-xs text-slate-400">Todas</span>}
                                        </TableCell>
                                        <TableCell>
                                            {campo.obrigatorio
                                                ? <Badge className="bg-red-100 text-red-600 text-xs">Sim</Badge>
                                                : <span className="text-xs text-slate-400">Não</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={campo.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                                                {campo.ativo ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => { setEditingCampo(campo); setShowModal(true); }}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon"
                                                    onClick={() => toggleAtivo.mutate({ id: campo.id, ativo: !campo.ativo })}
                                                    className={campo.ativo ? 'text-amber-600' : 'text-emerald-600'}>
                                                    <ToggleLeft className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingCampo ? 'Editar Campo' : 'Novo Campo de Produto'}</DialogTitle>
                    </DialogHeader>
                    <CampoForm
                        campo={editingCampo}
                        onSave={(data) => saveCampo.mutate(data)}
                        onCancel={() => { setShowModal(false); setEditingCampo(null); }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}