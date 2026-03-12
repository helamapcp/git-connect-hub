import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Edit, Package, ToggleLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORIAS = ['TELHA', 'FORRO', 'CUMEEIRA', 'PORTA', 'ACABAMENTO'];
const UNIDADES_POR_CATEGORIA = {
    FORRO: 'CAIXA', ACABAMENTO: 'CAIXA',
    TELHA: 'UNIDADE', CUMEEIRA: 'UNIDADE', PORTA: 'UNIDADE'
};

function DynamicFields({ campos, valores, onChange }) {
    if (!campos.length) return null;
    return (
        <div className="space-y-3 border-t pt-4 mt-4">
            <p className="text-sm font-semibold text-slate-600">Campos Dinâmicos</p>
            {campos.map(campo => {
                const val = valores[campo.id] || '';
                const setVal = (v) => onChange({ ...valores, [campo.id]: v });
                return (
                    <div key={campo.id} className="space-y-1">
                        <Label>{campo.label}{campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}</Label>
                        {campo.tipo_dado === 'boolean' ? (
                            <div className="flex items-center gap-2">
                                <Switch checked={val === 'true'} onCheckedChange={c => setVal(c ? 'true' : 'false')} />
                                <span className="text-sm text-slate-600">{val === 'true' ? 'Sim' : 'Não'}</span>
                            </div>
                        ) : campo.tipo_dado === 'select' ? (
                            <Select value={val} onValueChange={setVal}>
                                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    {(() => { try { return JSON.parse(campo.opcoes_select || '[]'); } catch { return []; } })()
                                        .map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                type={campo.tipo_dado === 'number' ? 'number' : 'text'}
                                value={val}
                                onChange={e => setVal(e.target.value)}
                                placeholder={campo.label}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default function Produtos() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showInactive, setShowInactive] = useState(false);
    const [editingProduto, setEditingProduto] = useState(null);
    const [form, setForm] = useState({ codigo: '', nome: '', categoria: '', unidade_producao: 'UNIDADE', notas: '' });
    const [campoValores, setCampoValores] = useState({});

    const { data: produtos = [], isLoading } = useQuery({
        queryKey: ['produtos', showInactive],
        queryFn: () => showInactive
            ? base44.entities.Produto.list()
            : base44.entities.Produto.filter({ ativo: true })
    });

    const { data: todosCampos = [] } = useQuery({
        queryKey: ['produto-campos'],
        queryFn: () => base44.entities.ProdutoCampo.filter({ ativo: true })
    });

    const { data: todosValores = [] } = useQuery({
        queryKey: ['produto-valores'],
        queryFn: () => base44.entities.ProdutoValor.list()
    });

    const camposAtivos = todosCampos.filter(c =>
        !c.categoria_aplicavel || c.categoria_aplicavel === form.categoria
    ).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    const createProduto = useMutation({
        mutationFn: async (data) => {
            const produto = await base44.entities.Produto.create(data.produto);
            const promises = Object.entries(data.valores).map(([campoId, valor]) => {
                if (!valor) return null;
                const campo = todosCampos.find(c => c.id === campoId);
                return base44.entities.ProdutoValor.create({
                    produto_id: produto.id,
                    campo_id: campoId,
                    nome_campo: campo?.nome_campo || campoId,
                    valor: String(valor)
                });
            }).filter(Boolean);
            await Promise.all(promises);
            return produto;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['produtos']);
            queryClient.invalidateQueries(['produto-valores']);
            setShowModal(false);
            toast.success('Produto criado!');
        }
    });

    const updateProduto = useMutation({
        mutationFn: async (data) => {
            await base44.entities.Produto.update(data.id, data.produto);
            // Update/create valores
            const promises = Object.entries(data.valores).map(([campoId, valor]) => {
                const campo = todosCampos.find(c => c.id === campoId);
                const existing = todosValores.find(v => v.produto_id === data.id && v.campo_id === campoId);
                if (existing) {
                    return base44.entities.ProdutoValor.update(existing.id, { valor: String(valor) });
                } else if (valor) {
                    return base44.entities.ProdutoValor.create({
                        produto_id: data.id,
                        campo_id: campoId,
                        nome_campo: campo?.nome_campo || campoId,
                        valor: String(valor)
                    });
                }
                return null;
            }).filter(Boolean);
            await Promise.all(promises);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['produtos']);
            queryClient.invalidateQueries(['produto-valores']);
            setShowModal(false);
            toast.success('Produto atualizado!');
        }
    });

    const toggleAtivo = useMutation({
        mutationFn: ({ id, ativo }) => base44.entities.Produto.update(id, { ativo }),
        onSuccess: () => {
            queryClient.invalidateQueries(['produtos']);
            toast.success('Status atualizado!');
        }
    });

    const handleOpenModal = (produto = null) => {
        if (produto) {
            setEditingProduto(produto);
            setForm({
                codigo: produto.codigo,
                nome: produto.nome,
                categoria: produto.categoria || '',
                unidade_producao: produto.unidade_producao || 'UNIDADE',
                notas: produto.notas || ''
            });
            // Carregar valores existentes
            const vals = {};
            todosValores.filter(v => v.produto_id === produto.id).forEach(v => {
                vals[v.campo_id] = v.valor;
            });
            setCampoValores(vals);
        } else {
            setEditingProduto(null);
            setForm({ codigo: '', nome: '', categoria: '', unidade_producao: 'UNIDADE', notas: '' });
            setCampoValores({});
        }
        setShowModal(true);
    };

    const handleCategoriaChange = (cat) => {
        setForm(prev => ({ ...prev, categoria: cat, unidade_producao: UNIDADES_POR_CATEGORIA[cat] || 'UNIDADE' }));
        setCampoValores({}); // reset dinâmicos ao trocar categoria
    };

    const handleSubmit = () => {
        if (!form.codigo || !form.nome || !form.categoria) {
            toast.error('Preencha código, nome e categoria');
            return;
        }
        // Validar obrigatórios
        const camposFaltando = camposAtivos.filter(c => c.obrigatorio && !campoValores[c.id]);
        if (camposFaltando.length > 0) {
            toast.error(`Campos obrigatórios: ${camposFaltando.map(c => c.label).join(', ')}`);
            return;
        }
        if (editingProduto) {
            updateProduto.mutate({ id: editingProduto.id, produto: { ...form, ativo: editingProduto.ativo }, valores: campoValores });
        } else {
            createProduto.mutate({ produto: { ...form, ativo: true }, valores: campoValores });
        }
    };

    const filtered = produtos.filter(p =>
        p.nome?.toLowerCase().includes(search.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(search.toLowerCase())
    );

    const getCampoValor = (produtoId, campoId) => {
        const v = todosValores.find(v => v.produto_id === produtoId && v.campo_id === campoId);
        return v?.valor || '-';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Gestão de Produtos</h1>
                        <p className="text-slate-500">Cadastro e gerenciamento de produtos</p>
                    </div>
                    <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />Novo Produto
                    </Button>
                </div>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row gap-4 items-center">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input placeholder="Buscar por código ou nome..." value={search}
                                    onChange={e => setSearch(e.target.value)} className="pl-10" />
                            </div>
                            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                <Switch checked={showInactive} onCheckedChange={setShowInactive} />
                                Mostrar inativos
                            </label>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Categoria</TableHead>
                                    <TableHead>Unidade</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array(4).fill(0).map((_, i) => (
                                        <TableRow key={i}>{Array(6).fill(0).map((_, j) => (
                                            <TableCell key={j}><div className="h-4 bg-slate-200 rounded animate-pulse w-20" /></TableCell>
                                        ))}</TableRow>
                                    ))
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12">
                                            <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                                            <p className="text-slate-500">Nenhum produto encontrado</p>
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.map(p => (
                                    <TableRow key={p.id} className={!p.ativo ? 'opacity-50' : ''}>
                                        <TableCell className="font-semibold">{p.codigo}</TableCell>
                                        <TableCell>{p.nome}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{p.categoria}</Badge>
                                        </TableCell>
                                        <TableCell>{p.unidade_producao}</TableCell>
                                        <TableCell>
                                            <Badge className={p.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                                                {p.ativo ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenModal(p)}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon"
                                                    onClick={() => toggleAtivo.mutate({ id: p.id, ativo: !p.ativo })}
                                                    className={p.ativo ? 'text-amber-600' : 'text-emerald-600'}>
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
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingProduto ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Código *</Label>
                                <Input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} placeholder="PROD-001" />
                            </div>
                            <div className="space-y-1">
                                <Label>Nome *</Label>
                                <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Telha PVC 200mm" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Categoria *</Label>
                                <Select value={form.categoria} onValueChange={handleCategoriaChange}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Unidade Produção</Label>
                                <Select value={form.unidade_producao} onValueChange={v => setForm(p => ({ ...p, unidade_producao: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="UNIDADE">UNIDADE</SelectItem>
                                        <SelectItem value="CAIXA">CAIXA</SelectItem>
                                        <SelectItem value="metros">metros</SelectItem>
                                        <SelectItem value="kg">kg</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>Notas</Label>
                            <Textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observações..." />
                        </div>
                        {form.categoria && (
                            <DynamicFields campos={camposAtivos} valores={campoValores} onChange={setCampoValores} />
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit} disabled={createProduto.isPending || updateProduto.isPending}
                            className="bg-blue-600 hover:bg-blue-700">
                            {editingProduto ? 'Salvar' : 'Criar Produto'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}