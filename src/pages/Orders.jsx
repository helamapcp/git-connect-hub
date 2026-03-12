import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Package, Filter, Edit, Trash2, CheckCircle, Clock, Pause, XCircle, AlertTriangle, FileText } from "lucide-react";
import { createPageUrl } from '@/utils';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusConfig = {
    LIBERADA: { label: 'Liberada', color: 'bg-slate-100 text-slate-700' },
    PLANEJADA: { label: 'Planejada', color: 'bg-slate-100 text-slate-600' },
    EM_PRODUCAO: { label: 'Em Produção', color: 'bg-blue-100 text-blue-700' },
    PAUSADA: { label: 'Pausada', color: 'bg-amber-100 text-amber-700' },
    FINALIZADA: { label: 'Finalizada', color: 'bg-emerald-100 text-emerald-700' },
    CANCELADA: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
    pending: { label: 'Pendente', color: 'bg-slate-100 text-slate-700' },
    in_progress: { label: 'Em Produção', color: 'bg-blue-100 text-blue-700' },
    paused: { label: 'Pausada', color: 'bg-amber-100 text-amber-700' },
    completed: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700' },
    cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700' }
};

const emptyOrder = {
    order_type: 'PADRAO',
    product_code: '',
    product_name: '',
    produto_id: '',
    categoria_processo: '',
    quantity_planned: '',
    unidade_producao: 'UNIDADE',
    machine_id: '',
    priority: 'normal',
    prioridade_numerica: 0,
    scheduled_date: '',
    notes: ''
};

async function gerarNumeroOP() {
    const sequences = await base44.entities.OpSequence.list();
    const seq = sequences[0];
    if (!seq) throw new Error('Sequência OP não encontrada');
    const novoNumero = (seq.ultimo_numero || 0) + 1;
    await base44.entities.OpSequence.update(seq.id, { ultimo_numero: novoNumero });
    const prefixo = seq.prefixo || 'OP';
    return `${prefixo}-${String(novoNumero).padStart(6, '0')}`;
}

export default function Orders() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [formData, setFormData] = useState(emptyOrder);

    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['all-orders'],
        queryFn: () => base44.entities.ProductionOrder.filter({ active: true }, '-created_date')
    });

    const { data: machines = [] } = useQuery({
        queryKey: ['machines'],
        queryFn: () => base44.entities.Machine.filter({ active: true })
    });

    const { data: produtos = [] } = useQuery({
        queryKey: ['produtos-ativos'],
        queryFn: () => base44.entities.Produto.filter({ ativo: true })
    });

    const createOrder = useMutation({
        mutationFn: (data) => base44.entities.ProductionOrder.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['all-orders']);
            setShowModal(false);
            setFormData(emptyOrder);
            toast.success('Ordem criada!');
        }
    });

    const updateOrder = useMutation({
        mutationFn: ({ id, data }) => base44.entities.ProductionOrder.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['all-orders']);
            setShowModal(false);
            setEditingOrder(null);
            setFormData(emptyOrder);
            toast.success('Ordem atualizada!');
        }
    });

    const deleteOrder = useMutation({
        mutationFn: (id) => base44.entities.ProductionOrder.update(id, { active: false }),
        onSuccess: () => {
            queryClient.invalidateQueries(['all-orders']);
            toast.success('Ordem removida!');
        }
    });

    const handleOpenModal = (order = null) => {
        if (order) {
            setEditingOrder(order);
            setFormData({
                order_number: order.order_number,
                order_type: order.order_type || 'PADRAO',
                product_code: order.product_code,
                product_name: order.product_name,
                categoria_processo: order.categoria_processo || '',
                quantity_planned: order.quantity_planned,
                unidade_producao: order.unidade_producao || 'UNIDADE',
                machine_id: order.machine_id || '',
                priority: order.priority || 'normal',
                prioridade_numerica: order.prioridade_numerica || 0,
                scheduled_date: order.scheduled_date || '',
                notes: order.notes || ''
            });
        } else {
            setEditingOrder(null);
            setFormData(emptyOrder);
        }
        setShowModal(true);
    };

    const handleCategoriaChange = (cat) => {
        setFormData(prev => ({
            ...prev,
            categoria_processo: cat,
            unidade_producao: unidadePorCategoria[cat] || 'UNIDADE'
        }));
    };

    const handleSubmit = async () => {
        if (!formData.product_code || !formData.quantity_planned || !formData.order_type) {
            toast.error('Preencha os campos obrigatórios: tipo, produto e quantidade');
            return;
        }
        const machineCode = machines.find(m => m.id === formData.machine_id)?.code;
        let orderNumber = editingOrder?.order_number;
        if (!editingOrder) {
            orderNumber = await gerarNumeroOP();
        }
        const data = {
            ...formData,
            order_number: orderNumber,
            quantity_planned: parseFloat(formData.quantity_planned),
            machine_code: machineCode,
            status: editingOrder?.status || 'LIBERADA',
            active: true
        };
        if (editingOrder) updateOrder.mutate({ id: editingOrder.id, data });
        else createOrder.mutate(data);
    };

    const filteredOrders = orders.filter(order => {
        const matchesSearch =
            order.order_number?.toLowerCase().includes(search.toLowerCase()) ||
            order.product_name?.toLowerCase().includes(search.toLowerCase()) ||
            order.product_code?.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        const matchesType = typeFilter === 'all' || order.order_type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Ordens de Produção</h1>
                        <p className="text-slate-500">Gerencie as ordens de produção</p>
                    </div>
                    <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />Nova Ordem
                    </Button>
                </div>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium">Fluxo:</span>
                            <Link to={createPageUrl('Orders')}><Badge variant="secondary">OP</Badge></Link>
                            <span className="text-muted-foreground">→</span>
                            <Link to={createPageUrl('MachineSelection')}><Badge variant="secondary">Produção</Badge></Link>
                            <span className="text-muted-foreground">→</span>
                            <Link to={createPageUrl('PATracking')}><Badge>PA</Badge></Link>
                            <span className="text-muted-foreground">→</span>
                            <Link to={createPageUrl('FactoryDashboard')}><Badge variant="outline">Logística</Badge></Link>
                        </div>
                    </CardContent>
                </Card>

                {/* Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input placeholder="Buscar por número, produto..." value={search}
                                    onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                            </div>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-[160px]">
                                    <FileText className="w-4 h-4 mr-2" />
                                    <SelectValue placeholder="Tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos tipos</SelectItem>
                                    <SelectItem value="PADRAO">Padrão</SelectItem>
                                    <SelectItem value="PEDIDO">Pedido</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <Filter className="w-4 h-4 mr-2" />
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos os status</SelectItem>
                                    <SelectItem value="LIBERADA">Liberada</SelectItem>
                                    <SelectItem value="EM_PRODUCAO">Em Produção</SelectItem>
                                    <SelectItem value="PAUSADA">Pausada</SelectItem>
                                    <SelectItem value="FINALIZADA">Finalizada</SelectItem>
                                    <SelectItem value="CANCELADA">Cancelada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Table */}
                <Card>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ordem</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Produto / Categoria</TableHead>
                                    <TableHead>Máquina</TableHead>
                                    <TableHead>Meta</TableHead>
                                    <TableHead>Produzido</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array(5).fill(0).map((_, i) => (
                                        <TableRow key={i}>
                                            {Array(8).fill(0).map((_, j) => (
                                                <TableCell key={j}><div className="h-4 bg-slate-200 rounded animate-pulse w-20" /></TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : filteredOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12">
                                            <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                                            <p className="text-slate-500">Nenhuma ordem encontrada</p>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredOrders.map(order => {
                                    const status = statusConfig[order.status] || statusConfig.LIBERADA;
                                    const progress = order.quantity_planned > 0
                                        ? ((order.quantity_produced || 0) / order.quantity_planned * 100).toFixed(0) : 0;

                                    return (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-semibold">{order.order_number}</TableCell>
                                            <TableCell>
                                                <Badge className={cn(
                                                    "text-xs",
                                                    order.order_type === 'PEDIDO' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                                                )}>
                                                    {order.order_type === 'PEDIDO' ? 'PEDIDO' : 'PADRÃO'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{order.product_name}</p>
                                                    <p className="text-xs text-slate-500">{order.product_code}{order.categoria_processo ? ` · ${order.categoria_processo}` : ''}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-slate-600">{order.machine_code || '-'}</TableCell>
                                            <TableCell>{order.quantity_planned} {order.unidade_producao || order.unit}</TableCell>
                                            <TableCell>
                                                <span className={cn("font-medium", parseFloat(progress) >= 100 ? "text-emerald-600" : "text-slate-900")}>
                                                    {order.quantity_produced || 0}
                                                </span>
                                                <span className="text-xs text-slate-400 ml-1">({progress}%)</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={status.color}>{status.label}</Badge>
                                                {['PAUSADA', 'paused'].includes(order.status) && (
                                                    <Badge className="ml-1 bg-blue-100 text-blue-700 text-xs">
                                                        <Clock className="w-3 h-3 mr-1" />Pausada
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenModal(order)}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon"
                                                        onClick={() => deleteOrder.mutate(order.id)}
                                                        className="text-red-500 hover:text-red-700">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Modal */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingOrder ? 'Editar Ordem' : 'Nova Ordem de Produção'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Tipo OP */}
                        <div className="space-y-2">
                            <Label>Tipo de OP *</Label>
                            <div className="grid grid-cols-2 gap-3">
                                {['PADRAO', 'PEDIDO'].map(tipo => (
                                    <button key={tipo} type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, order_type: tipo }))}
                                        className={cn(
                                            "p-4 rounded-xl border-2 font-semibold transition-all text-sm",
                                            formData.order_type === tipo
                                                ? tipo === 'PEDIDO' ? "border-amber-500 bg-amber-50 text-amber-700" : "border-blue-500 bg-blue-50 text-blue-700"
                                                : "border-slate-200 text-slate-600 hover:border-slate-300"
                                        )}>
                                        {tipo === 'PADRAO' ? '📋 OP Padrão' : '⚡ OP Pedido'}
                                        <p className="text-xs font-normal mt-1 opacity-70">
                                            {tipo === 'PADRAO' ? 'Produção regular' : 'Urgente / Cliente'}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {editingOrder && (
                            <div className="space-y-1 bg-slate-50 rounded-lg p-3">
                                <Label className="text-slate-500 text-xs">Número da OP (gerado automaticamente)</Label>
                                <p className="font-bold text-slate-900">{editingOrder.order_number}</p>
                            </div>
                        )}
                        {!editingOrder && (
                            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                                📋 O número da OP será gerado automaticamente no formato OP-000001
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Produto *</Label>
                            {produtos.length > 0 ? (
                                <Select value={formData.produto_id || ''}
                                    onValueChange={v => {
                                        const prod = produtos.find(p => p.id === v);
                                        if (prod) setFormData(prev => ({
                                            ...prev,
                                            produto_id: prod.id,
                                            product_code: prod.codigo,
                                            product_name: prod.nome,
                                            categoria_processo: prod.categoria,
                                            unidade_producao: prod.unidade_producao || 'UNIDADE'
                                        }));
                                    }}>
                                    <SelectTrigger><SelectValue placeholder="Selecione um produto..." /></SelectTrigger>
                                    <SelectContent>
                                        {produtos.map(p => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.codigo} — {p.nome} ({p.categoria})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input value={formData.product_code}
                                            onChange={e => setFormData(p => ({ ...p, product_code: e.target.value }))}
                                            placeholder="Código do produto" />
                                        <Input value={formData.product_name}
                                            onChange={e => setFormData(p => ({ ...p, product_name: e.target.value }))}
                                            placeholder="Nome do produto" />
                                    </div>
                                    <p className="text-xs text-amber-600">Nenhum produto cadastrado. <a href="#" className="underline">Cadastre produtos</a> para usar a seleção.</p>
                                </div>
                            )}
                        </div>

                        {formData.categoria_processo && (
                            <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-2 text-sm">
                                <div><span className="text-slate-500">Categoria:</span> <strong>{formData.categoria_processo}</strong></div>
                                <div><span className="text-slate-500">Unidade:</span> <strong>{formData.unidade_producao}</strong></div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Quantidade Planejada *</Label>
                                <Input type="number" value={formData.quantity_planned}
                                    onChange={(e) => setFormData({ ...formData, quantity_planned: e.target.value })}
                                    placeholder="1000" />
                            </div>
                            <div className="space-y-2">
                                <Label>Prioridade</Label>
                                <Select value={formData.priority}
                                    onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Baixa</SelectItem>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="high">Alta</SelectItem>
                                        <SelectItem value="urgent">Urgente</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Máquina</Label>
                            <Select value={formData.machine_id}
                                onValueChange={(v) => setFormData({ ...formData, machine_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Selecione uma máquina" /></SelectTrigger>
                                <SelectContent>
                                    {machines.map(m => (
                                        <SelectItem key={m.id} value={m.id}>{m.code} - {m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Observações</Label>
                            <Textarea value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Observações sobre a ordem..." />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit}
                            disabled={!formData.product_code || !formData.quantity_planned || !formData.order_type || createOrder.isPending || updateOrder.isPending}
                            className="bg-blue-600 hover:bg-blue-700">
                            {createOrder.isPending ? 'Gerando OP...' : editingOrder ? 'Salvar' : 'Criar Ordem'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}