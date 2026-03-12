import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Plus, Edit, Trash2, Factory, Clock, AlertTriangle,
    Package, Settings as SettingsIcon, Search, ToggleLeft, SlidersHorizontal, Upload, Users, FlaskConical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ImportacaoMassa from "@/components/settings/ImportacaoMassa";
import GestaoUsuarios from "@/components/settings/GestaoUsuarios";
import MateriaPrimaTab from "@/components/settings/MateriaPrimaTab";

// ─── Constantes Produto/Campos ───────────────────────────────────────────────
const CATEGORIAS_PRODUTO = ['TELHA', 'FORRO', 'CUMEEIRA', 'PORTA', 'ACABAMENTO'];
const UNIDADES_POR_CATEGORIA = {
    FORRO: 'CAIXA', ACABAMENTO: 'CAIXA',
    TELHA: 'UNIDADE', CUMEEIRA: 'UNIDADE', PORTA: 'UNIDADE'
};
const TIPO_DADO_LABEL = { string: 'Texto', number: 'Número', select: 'Lista', boolean: 'Sim/Não' };

const MACHINE_CATEGORY_STORAGE_KEY = 'settings-machine-categories-v1';
const DEFAULT_MACHINE_CATEGORIES = [
    { id: 'cat-extrusora', name: 'extrusora' },
    { id: 'cat-injetora', name: 'injetora' },
    { id: 'cat-cortadeira', name: 'cortadeira' },
    { id: 'cat-embaladora', name: 'embaladora' },
];

// ─── DynamicFields ────────────────────────────────────────────────────────────
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

// ─── CampoForm ────────────────────────────────────────────────────────────────
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
                    <Input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="Peso Unitário" />
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
                            {CATEGORIAS_PRODUTO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            {form.tipo_dado === 'select' && (
                <div className="space-y-1">
                    <Label>Opções (JSON array)</Label>
                    <Input value={form.opcoes_select} onChange={e => setForm(p => ({ ...p, opcoes_select: e.target.value }))}
                        placeholder='["Opção 1", "Opção 2"]' />
                    <p className="text-xs text-slate-400">Formato: ["op1", "op2"]</p>
                </div>
            )}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label>Ordem de exibição</Label>
                    <Input type="number" value={form.ordem} onChange={e => setForm(p => ({ ...p, ordem: parseInt(e.target.value) || 0 }))} />
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

// Machine Form
function MachineForm({ machine, onSave, onCancel, categories = [] }) {
    const baseCategories = categories.length ? categories : DEFAULT_MACHINE_CATEGORIES;
    const hasCurrentMachineType = !!machine?.type && baseCategories.some((category) => category.name === machine.type);
    const availableCategories = hasCurrentMachineType
        ? baseCategories
        : (machine?.type ? [{ id: `cat-current-${machine.id || 'temp'}`, name: machine.type }, ...baseCategories] : baseCategories);
    const defaultType = machine?.type || availableCategories[0]?.name || 'extrusora';

    const [form, setForm] = useState(machine || {
        code: '',
        name: '',
        type: defaultType,
        sector: '',
        status: 'available'
    });

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Código *</Label>
                    <Input
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                        placeholder="EXT-001"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Extrusora Principal"
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {availableCategories.map((category) => (
                                <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Setor</Label>
                    <Input
                        value={form.sector}
                        onChange={(e) => setForm({ ...form, sector: e.target.value })}
                        placeholder="Setor A"
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="available">Disponível</SelectItem>
                        <SelectItem value="in_production">Em Produção</SelectItem>
                        <SelectItem value="maintenance">Manutenção</SelectItem>
                        <SelectItem value="inactive">Inativa</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                <Button onClick={() => onSave(form)} disabled={!form.code || !form.name}>
                    Salvar
                </Button>
            </DialogFooter>
        </div>
    );
}

// Shift Form
function ShiftForm({ shift, onSave, onCancel }) {
    const [form, setForm] = useState(shift || {
        name: '',
        start_time: '',
        end_time: ''
    });

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Nome do Turno *</Label>
                <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="1º Turno"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Hora Início *</Label>
                    <Input
                        type="time"
                        value={form.start_time}
                        onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Hora Fim *</Label>
                    <Input
                        type="time"
                        value={form.end_time}
                        onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                <Button onClick={() => onSave(form)} disabled={!form.name || !form.start_time || !form.end_time}>
                    Salvar
                </Button>
            </DialogFooter>
        </div>
    );
}

// Reason Form
function ReasonForm({ reason, type, onSave, onCancel }) {
    const categories = type === 'downtime'
        ? ['planned', 'unplanned', 'maintenance', 'setup', 'quality']
        : ['material', 'process', 'equipment', 'operator', 'quality'];

    const categoryLabels = type === 'downtime'
        ? { planned: 'Planejada', unplanned: 'Não Planejada', maintenance: 'Manutenção', setup: 'Setup', quality: 'Qualidade' }
        : { material: 'Material', process: 'Processo', equipment: 'Equipamento', operator: 'Operador', quality: 'Qualidade' };

    const [form, setForm] = useState(reason || {
        code: '',
        name: '',
        category: categories[0],
        description: ''
    });

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Código *</Label>
                    <Input
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                        placeholder="PAR-001"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Falta de Material"
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {categories.map(cat => (
                            <SelectItem key={cat} value={cat}>{categoryLabels[cat]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Descrição opcional"
                />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                <Button onClick={() => onSave(form)} disabled={!form.code || !form.name}>
                    Salvar
                </Button>
            </DialogFooter>
        </div>
    );
}

// ─── RawMaterial Form ─────────────────────────────────────────────────────────
function RawMaterialForm({ material, onSave, onCancel }) {
    const [form, setForm] = useState(material || { codigo: '', nome: '', tipo: 'PVC', unidade: 'kg', peso_saco_kg: '', ativo: true });
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label>Código *</Label>
                    <Input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} placeholder="MP-001" />
                </div>
                <div className="space-y-1">
                    <Label>Nome *</Label>
                    <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="PVC Virgem" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {['PVC', 'Aditivo', 'Pigmento', 'Estabilizante', 'Plastificante', 'Outro'].map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label>Unidade</Label>
                    <Select value={form.unidade} onValueChange={v => setForm(p => ({ ...p, unidade: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="L">L</SelectItem>
                            <SelectItem value="un">un</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="space-y-1">
                <Label>Peso do Saco Fechado (kg)</Label>
                <Input
                    type="number"
                    value={form.peso_saco_kg || ''}
                    onChange={e => setForm(p => ({ ...p, peso_saco_kg: parseFloat(e.target.value) || '' }))}
                    placeholder="25"
                />
                <p className="text-xs text-slate-400">Usado para calcular número de sacos na formulação</p>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                <Button onClick={() => onSave(form)} disabled={!form.codigo || !form.nome}>Salvar</Button>
            </DialogFooter>
        </div>
    );
}

export default function Settings() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('machines');
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const [machineCategories, setMachineCategories] = useState(DEFAULT_MACHINE_CATEGORIES);
    const [newMachineCategory, setNewMachineCategory] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [categoryToDelete, setCategoryToDelete] = useState(null);

    // ── Produto state ──────────────────────────────────────────────
    const [prodSearch, setProdSearch] = useState('');
    const [showInactiveProd, setShowInactiveProd] = useState(false);
    const [showProdModal, setShowProdModal] = useState(false);
    const [editingProduto, setEditingProduto] = useState(null);
    const [prodForm, setProdForm] = useState({ codigo: '', nome: '', categoria: '', unidade_producao: 'UNIDADE', notas: '' });
    const [campoValores, setCampoValores] = useState({});

    // ── Campos state ───────────────────────────────────────────────
    const [showInactiveCampos, setShowInactiveCampos] = useState(false);
    const [showCampoModal, setShowCampoModal] = useState(false);
    const [editingCampo, setEditingCampo] = useState(null);

    // ── Produto queries/mutations ────────────────────────────────────
    const { data: produtos = [], isLoading: loadingProdutos } = useQuery({
        queryKey: ['settings-produtos', showInactiveProd],
        queryFn: () => showInactiveProd ? base44.entities.Produto.list() : base44.entities.Produto.filter({ ativo: true })
    });
    const { data: todosCampos = [] } = useQuery({
        queryKey: ['settings-produto-campos'],
        queryFn: () => base44.entities.ProdutoCampo.filter({ ativo: true })
    });
    const { data: todosValores = [] } = useQuery({
        queryKey: ['settings-produto-valores'],
        queryFn: () => base44.entities.ProdutoValor.list()
    });

    const camposAtivos = todosCampos.filter(c =>
        !c.categoria_aplicavel || c.categoria_aplicavel === prodForm.categoria
    ).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    const createProduto = useMutation({
        mutationFn: async (data) => {
            const produto = await base44.entities.Produto.create(data.produto);
            const promises = Object.entries(data.valores).map(([campoId, valor]) => {
                if (!valor) return null;
                const campo = todosCampos.find(c => c.id === campoId);
                return base44.entities.ProdutoValor.create({ produto_id: produto.id, campo_id: campoId, nome_campo: campo?.nome_campo || campoId, valor: String(valor) });
            }).filter(Boolean);
            await Promise.all(promises);
            return produto;
        },
        onSuccess: () => { queryClient.invalidateQueries(['settings-produtos']); setShowProdModal(false); toast.success('Produto criado!'); }
    });

    const updateProduto = useMutation({
        mutationFn: async (data) => {
            await base44.entities.Produto.update(data.id, data.produto);
            const promises = Object.entries(data.valores).map(([campoId, valor]) => {
                const campo = todosCampos.find(c => c.id === campoId);
                const existing = todosValores.find(v => v.produto_id === data.id && v.campo_id === campoId);
                if (existing) return base44.entities.ProdutoValor.update(existing.id, { valor: String(valor) });
                else if (valor) return base44.entities.ProdutoValor.create({ produto_id: data.id, campo_id: campoId, nome_campo: campo?.nome_campo || campoId, valor: String(valor) });
                return null;
            }).filter(Boolean);
            await Promise.all(promises);
        },
        onSuccess: () => { queryClient.invalidateQueries(['settings-produtos']); setShowProdModal(false); toast.success('Produto atualizado!'); }
    });

    const toggleAtivoProduto = useMutation({
        mutationFn: ({ id, ativo }) => base44.entities.Produto.update(id, { ativo }),
        onSuccess: () => { queryClient.invalidateQueries(['settings-produtos']); toast.success('Status atualizado!'); }
    });

    const handleOpenProdModal = (produto = null) => {
        if (produto) {
            setEditingProduto(produto);
            setProdForm({ codigo: produto.codigo, nome: produto.nome, categoria: produto.categoria || '', unidade_producao: produto.unidade_producao || 'UNIDADE', notas: produto.notas || '' });
            const vals = {};
            todosValores.filter(v => v.produto_id === produto.id).forEach(v => { vals[v.campo_id] = v.valor; });
            setCampoValores(vals);
        } else {
            setEditingProduto(null);
            setProdForm({ codigo: '', nome: '', categoria: '', unidade_producao: 'UNIDADE', notas: '' });
            setCampoValores({});
        }
        setShowProdModal(true);
    };

    const handleSubmitProduto = () => {
        if (!prodForm.codigo || !prodForm.nome || !prodForm.categoria) { toast.error('Preencha código, nome e categoria'); return; }
        const camposFaltando = camposAtivos.filter(c => c.obrigatorio && !campoValores[c.id]);
        if (camposFaltando.length > 0) { toast.error(`Campos obrigatórios: ${camposFaltando.map(c => c.label).join(', ')}`); return; }
        if (editingProduto) updateProduto.mutate({ id: editingProduto.id, produto: { ...prodForm, ativo: editingProduto.ativo }, valores: campoValores });
        else createProduto.mutate({ produto: { ...prodForm, ativo: true }, valores: campoValores });
    };

    const filteredProdutos = produtos.filter(p =>
        p.nome?.toLowerCase().includes(prodSearch.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(prodSearch.toLowerCase())
    );

    // ── Campos queries/mutations ─────────────────────────────────────
    const { data: campos = [], isLoading: loadingCampos } = useQuery({
        queryKey: ['settings-produto-campos-admin', showInactiveCampos],
        queryFn: () => showInactiveCampos ? base44.entities.ProdutoCampo.list() : base44.entities.ProdutoCampo.filter({ ativo: true })
    });

    const saveCampo = useMutation({
        mutationFn: (data) => editingCampo
            ? base44.entities.ProdutoCampo.update(editingCampo.id, data)
            : base44.entities.ProdutoCampo.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['settings-produto-campos-admin']);
            queryClient.invalidateQueries(['settings-produto-campos']);
            setShowCampoModal(false); setEditingCampo(null);
            toast.success('Campo salvo!');
        }
    });

    const toggleAtivoCampo = useMutation({
        mutationFn: ({ id, ativo }) => base44.entities.ProdutoCampo.update(id, { ativo }),
        onSuccess: () => { queryClient.invalidateQueries(['settings-produto-campos-admin']); queryClient.invalidateQueries(['settings-produto-campos']); toast.success('Status atualizado!'); }
    });

    const sortedCampos = [...campos].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    // Queries
    const { data: machines = [] } = useQuery({
        queryKey: ['settings-machines'],
        queryFn: () => base44.entities.Machine.filter({ active: true })
    });

    const normalizeCategoryName = (value = '') => value.trim().toLowerCase();

    useEffect(() => {
        try {
            const raw = localStorage.getItem(MACHINE_CATEGORY_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return;
            const valid = parsed
                .filter((item) => item?.name)
                .map((item, index) => ({ id: item.id || `cat-local-${index}`, name: String(item.name) }));
            if (valid.length) setMachineCategories(valid);
        } catch {
            // ignore malformed storage
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(MACHINE_CATEGORY_STORAGE_KEY, JSON.stringify(machineCategories));
    }, [machineCategories]);

    const addMachineCategory = () => {
        const name = newMachineCategory.trim();
        if (!name) {
            toast.error('Informe o nome da categoria.');
            return;
        }
        const exists = machineCategories.some((category) => normalizeCategoryName(category.name) === normalizeCategoryName(name));
        if (exists) {
            toast.error('Essa categoria já existe.');
            return;
        }

        setMachineCategories((prev) => [
            ...prev,
            {
                id: `cat-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                name,
            },
        ]);
        setNewMachineCategory('');
        toast.success('Categoria adicionada!');
    };

    const startEditMachineCategory = (category) => {
        setEditingCategoryId(category.id);
        setEditingCategoryName(category.name);
    };

    const saveEditMachineCategory = (categoryId) => {
        const name = editingCategoryName.trim();
        if (!name) {
            toast.error('Informe o novo nome da categoria.');
            return;
        }

        const duplicate = machineCategories.some(
            (category) => category.id !== categoryId && normalizeCategoryName(category.name) === normalizeCategoryName(name)
        );
        if (duplicate) {
            toast.error('Já existe uma categoria com esse nome.');
            return;
        }

        setMachineCategories((prev) => prev.map((category) => (
            category.id === categoryId ? { ...category, name } : category
        )));
        setEditingCategoryId(null);
        setEditingCategoryName('');
        toast.success('Categoria atualizada!');
    };

    const confirmDeleteMachineCategory = () => {
        if (!categoryToDelete) return;

        const inUseCount = machines.filter(
            (machine) => normalizeCategoryName(machine.type || '') === normalizeCategoryName(categoryToDelete.name)
        ).length;

        if (inUseCount > 0) {
            toast.error(`Não é possível remover: ${inUseCount} máquina(s) ainda usam esta categoria.`);
            setCategoryToDelete(null);
            return;
        }

        setMachineCategories((prev) => prev.filter((category) => category.id !== categoryToDelete.id));
        if (editingCategoryId === categoryToDelete.id) {
            setEditingCategoryId(null);
            setEditingCategoryName('');
        }
        setCategoryToDelete(null);
        toast.success('Categoria removida!');
    };

    const getCategoryUsageCount = (categoryName) => (
        machines.filter((machine) => normalizeCategoryName(machine.type || '') === normalizeCategoryName(categoryName)).length
    );

    const { data: shifts = [] } = useQuery({
        queryKey: ['settings-shifts'],
        queryFn: () => base44.entities.Shift.filter({ active: true })
    });

    const { data: downtimeReasons = [] } = useQuery({
        queryKey: ['settings-downtime-reasons'],
        queryFn: () => base44.entities.DowntimeReason.filter({ active: true })
    });

    const { data: lossReasons = [] } = useQuery({
        queryKey: ['settings-loss-reasons'],
        queryFn: () => base44.entities.LossReason.filter({ active: true })
    });

    const { data: rawMaterials = [] } = useQuery({
        queryKey: ['settings-raw-materials'],
        queryFn: () => base44.entities.RawMaterial.list()
    });

    const [editingMaterial, setEditingMaterial] = useState(null);
    const [showMaterialModal, setShowMaterialModal] = useState(false);

    const saveMaterial = useMutation({
        mutationFn: (data) => editingMaterial
            ? base44.entities.RawMaterial.update(editingMaterial.id, data)
            : base44.entities.RawMaterial.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['settings-raw-materials']);
            queryClient.invalidateQueries(['raw-materials']);
            setShowMaterialModal(false); setEditingMaterial(null);
            toast.success('Matéria-prima salva!');
        }
    });

    const toggleMaterial = useMutation({
        mutationFn: ({ id, ativo }) => base44.entities.RawMaterial.update(id, { ativo }),
        onSuccess: () => { queryClient.invalidateQueries(['settings-raw-materials']); queryClient.invalidateQueries(['raw-materials']); toast.success('Status atualizado!'); }
    });

    // Mutations
    const saveMachine = useMutation({
        mutationFn: (data) => editingItem
            ? base44.entities.Machine.update(editingItem.id, data)
            : base44.entities.Machine.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['settings-machines']);
            setShowModal(false);
            setEditingItem(null);
            toast.success('Máquina salva com sucesso!');
        }
    });

    const saveShift = useMutation({
        mutationFn: (data) => editingItem
            ? base44.entities.Shift.update(editingItem.id, data)
            : base44.entities.Shift.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['settings-shifts']);
            setShowModal(false);
            setEditingItem(null);
            toast.success('Turno salvo com sucesso!');
        }
    });

    const saveDowntimeReason = useMutation({
        mutationFn: (data) => editingItem
            ? base44.entities.DowntimeReason.update(editingItem.id, data)
            : base44.entities.DowntimeReason.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['settings-downtime-reasons']);
            setShowModal(false);
            setEditingItem(null);
            toast.success('Motivo salvo com sucesso!');
        }
    });

    const saveLossReason = useMutation({
        mutationFn: (data) => editingItem
            ? base44.entities.LossReason.update(editingItem.id, data)
            : base44.entities.LossReason.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['settings-loss-reasons']);
            setShowModal(false);
            setEditingItem(null);
            toast.success('Motivo salvo com sucesso!');
        }
    });

    const deleteItem = useMutation({
        mutationFn: ({ entity, id }) => {
            const entities = {
                machines: base44.entities.Machine,
                shifts: base44.entities.Shift,
                downtime: base44.entities.DowntimeReason,
                loss: base44.entities.LossReason
            };
            return entities[entity].update(id, { active: false });
        },
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast.success('Item removido!');
        }
    });

    const handleAdd = () => {
        setEditingItem(null);
        setShowModal(true);
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setShowModal(true);
    };

    const handleSave = (data) => {
        switch (activeTab) {
            case 'machines':
                saveMachine.mutate(data);
                break;
            case 'shifts':
                saveShift.mutate(data);
                break;
            case 'downtime':
                saveDowntimeReason.mutate(data);
                break;
            case 'loss':
                saveLossReason.mutate(data);
                break;
        }
    };

    const handleDelete = (id) => {
        deleteItem.mutate({ entity: activeTab, id });
    };

    const getModalTitle = () => {
        const titles = {
            machines: 'Máquina',
            shifts: 'Turno',
            downtime: 'Motivo de Parada',
            loss: 'Motivo de Refugo'
        };
        return `${editingItem ? 'Editar' : 'Nova'} ${titles[activeTab]}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
                        <p className="text-slate-500">Gerencie máquinas, turnos e motivos</p>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid grid-cols-8 w-full max-w-5xl">
                        <TabsTrigger value="machines" className="flex items-center gap-1.5">
                            <Factory className="w-4 h-4" />
                            Máquinas
                        </TabsTrigger>
                        <TabsTrigger value="shifts" className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            Turnos
                        </TabsTrigger>
                        <TabsTrigger value="downtime" className="flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" />
                            Paradas
                        </TabsTrigger>
                        <TabsTrigger value="loss" className="flex items-center gap-1.5">
                            <Package className="w-4 h-4" />
                            Refugos
                        </TabsTrigger>
                        <TabsTrigger value="produtos" className="flex items-center gap-1.5">
                            <SettingsIcon className="w-4 h-4" />
                            Produtos
                        </TabsTrigger>
                        <TabsTrigger value="importacao" className="flex items-center gap-1.5">
                            <Upload className="w-4 h-4" />
                            Importação
                        </TabsTrigger>
                        <TabsTrigger value="materias-primas" className="flex items-center gap-1.5">
                            <FlaskConical className="w-4 h-4" />
                            Mat. Primas
                        </TabsTrigger>
                        <TabsTrigger value="usuarios" className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            Usuários
                        </TabsTrigger>
                    </TabsList>

                    {/* Machines Tab */}
                    <TabsContent value="machines">
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Categorias de Máquina</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex flex-col md:flex-row gap-2">
                                        <Input
                                            value={newMachineCategory}
                                            onChange={(e) => setNewMachineCategory(e.target.value)}
                                            placeholder="Nova categoria (ex: misturadora)"
                                        />
                                        <Button onClick={addMachineCategory} className="md:w-auto w-full">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Adicionar categoria
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        {machineCategories.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
                                        ) : machineCategories.map((category) => {
                                            const usageCount = getCategoryUsageCount(category.name);
                                            const isEditing = editingCategoryId === category.id;

                                            return (
                                                <div key={category.id} className="flex flex-col md:flex-row md:items-center justify-between gap-2 border rounded-md p-3">
                                                    <div className="flex-1">
                                                        {isEditing ? (
                                                            <Input
                                                                value={editingCategoryName}
                                                                onChange={(e) => setEditingCategoryName(e.target.value)}
                                                                placeholder="Nome da categoria"
                                                            />
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">{category.name}</span>
                                                                <Badge variant="secondary">{usageCount} máquina(s)</Badge>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2 justify-end">
                                                        {isEditing ? (
                                                            <>
                                                                <Button size="sm" onClick={() => saveEditMachineCategory(category.id)}>Salvar</Button>
                                                                <Button size="sm" variant="outline" onClick={() => { setEditingCategoryId(null); setEditingCategoryName(''); }}>
                                                                    Cancelar
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button size="sm" variant="outline" onClick={() => startEditMachineCategory(category)}>
                                                                    <Edit className="w-4 h-4 mr-1" /> Editar
                                                                </Button>
                                                                <Button size="sm" variant="ghost" onClick={() => setCategoryToDelete(category)}>
                                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle>Máquinas</CardTitle>
                                    <Button onClick={handleAdd}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Nova Máquina
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Código</TableHead>
                                                <TableHead>Nome</TableHead>
                                                <TableHead>Categoria</TableHead>
                                                <TableHead>Setor</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {machines.map(m => (
                                                <TableRow key={m.id}>
                                                    <TableCell className="font-semibold">{m.code}</TableCell>
                                                    <TableCell>{m.name}</TableCell>
                                                    <TableCell className="capitalize">{m.type}</TableCell>
                                                    <TableCell>{m.sector}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{m.status}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(m)}>
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
                                                            <Trash2 className="w-4 h-4 text-red-500" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Shifts Tab */}
                    <TabsContent value="shifts">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Turnos</CardTitle>
                                <Button onClick={handleAdd}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Novo Turno
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Início</TableHead>
                                            <TableHead>Fim</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {shifts.map(s => (
                                            <TableRow key={s.id}>
                                                <TableCell className="font-semibold">{s.name}</TableCell>
                                                <TableCell>{s.start_time}</TableCell>
                                                <TableCell>{s.end_time}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Downtime Reasons Tab */}
                    <TabsContent value="downtime">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Motivos de Parada</CardTitle>
                                <Button onClick={handleAdd}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Novo Motivo
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Código</TableHead>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Categoria</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {downtimeReasons.map(r => (
                                            <TableRow key={r.id}>
                                                <TableCell className="font-semibold">{r.code}</TableCell>
                                                <TableCell>{r.name}</TableCell>
                                                <TableCell className="capitalize">{r.category}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(r)}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Loss Reasons Tab */}
                    <TabsContent value="loss">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Motivos de Refugo</CardTitle>
                                <Button onClick={handleAdd}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Novo Motivo
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Código</TableHead>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Categoria</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {lossReasons.map(r => (
                                            <TableRow key={r.id}>
                                                <TableCell className="font-semibold">{r.code}</TableCell>
                                                <TableCell>{r.name}</TableCell>
                                                <TableCell className="capitalize">{r.category}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(r)}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Produtos Tab */}
                    <TabsContent value="produtos">
                        <Tabs defaultValue="lista-produtos">
                            <TabsList className="mb-4">
                                <TabsTrigger value="lista-produtos" className="flex items-center gap-1.5">
                                    <Package className="w-4 h-4" />
                                    Produtos
                                </TabsTrigger>
                                <TabsTrigger value="campos-produto" className="flex items-center gap-1.5">
                                    <SlidersHorizontal className="w-4 h-4" />
                                    Campos de Produto
                                </TabsTrigger>
                            </TabsList>

                            {/* Sub-tab: lista de produtos */}
                            <TabsContent value="lista-produtos">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
                                        <CardTitle>Produtos</CardTitle>
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                                <Switch checked={showInactiveProd} onCheckedChange={setShowInactiveProd} />
                                                Mostrar inativos
                                            </label>
                                            <Button onClick={() => handleOpenProdModal()} className="bg-blue-600 hover:bg-blue-700">
                                                <Plus className="w-4 h-4 mr-2" />Novo Produto
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="relative mb-4">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <Input placeholder="Buscar por código ou nome..." value={prodSearch}
                                                onChange={e => setProdSearch(e.target.value)} className="pl-10" />
                                        </div>
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
                                                {loadingProdutos ? (
                                                    Array(3).fill(0).map((_, i) => (
                                                        <TableRow key={i}>{Array(6).fill(0).map((_, j) => (
                                                            <TableCell key={j}><div className="h-4 bg-slate-200 rounded animate-pulse w-20" /></TableCell>
                                                        ))}</TableRow>
                                                    ))
                                                ) : filteredProdutos.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-10 text-slate-400">Nenhum produto encontrado</TableCell>
                                                    </TableRow>
                                                ) : filteredProdutos.map(p => (
                                                    <TableRow key={p.id} className={!p.ativo ? 'opacity-50' : ''}>
                                                        <TableCell className="font-semibold">{p.codigo}</TableCell>
                                                        <TableCell>{p.nome}</TableCell>
                                                        <TableCell><Badge variant="outline">{p.categoria}</Badge></TableCell>
                                                        <TableCell>{p.unidade_producao}</TableCell>
                                                        <TableCell>
                                                            <Badge className={p.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                                                                {p.ativo ? 'Ativo' : 'Inativo'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" onClick={() => handleOpenProdModal(p)}>
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon"
                                                                onClick={() => toggleAtivoProduto.mutate({ id: p.id, ativo: !p.ativo })}
                                                                className={p.ativo ? 'text-amber-600' : 'text-emerald-600'}>
                                                                <ToggleLeft className="w-4 h-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Sub-tab: campos de produto */}
                            <TabsContent value="campos-produto">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
                                        <CardTitle>Campos de Produto</CardTitle>
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                                <Switch checked={showInactiveCampos} onCheckedChange={setShowInactiveCampos} />
                                                Mostrar inativos
                                            </label>
                                            <Button onClick={() => { setEditingCampo(null); setShowCampoModal(true); }} className="bg-blue-600 hover:bg-blue-700">
                                                <Plus className="w-4 h-4 mr-2" />Novo Campo
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
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
                                                {loadingCampos ? (
                                                    Array(3).fill(0).map((_, i) => (
                                                        <TableRow key={i}>{Array(8).fill(0).map((_, j) => (
                                                            <TableCell key={j}><div className="h-4 bg-slate-200 rounded animate-pulse w-16" /></TableCell>
                                                        ))}</TableRow>
                                                    ))
                                                ) : sortedCampos.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={8} className="text-center py-10 text-slate-400">Nenhum campo cadastrado</TableCell>
                                                    </TableRow>
                                                ) : sortedCampos.map(campo => (
                                                    <TableRow key={campo.id} className={!campo.ativo ? 'opacity-50' : ''}>
                                                        <TableCell className="text-slate-500">{campo.ordem || 0}</TableCell>
                                                        <TableCell className="font-mono text-xs">{campo.nome_campo}</TableCell>
                                                        <TableCell className="font-medium">{campo.label}</TableCell>
                                                        <TableCell><Badge variant="outline">{TIPO_DADO_LABEL[campo.tipo_dado]}</Badge></TableCell>
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
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" onClick={() => { setEditingCampo(campo); setShowCampoModal(true); }}>
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon"
                                                                onClick={() => toggleAtivoCampo.mutate({ id: campo.id, ativo: !campo.ativo })}
                                                                className={campo.ativo ? 'text-amber-600' : 'text-emerald-600'}>
                                                                <ToggleLeft className="w-4 h-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </TabsContent>
                    {/* Matérias-Primas Tab */}
                    <TabsContent value="materias-primas">
                        <MateriaPrimaTab
                            rawMaterials={rawMaterials}
                            onNew={() => { setEditingMaterial(null); setShowMaterialModal(true); }}
                            onEdit={(m) => { setEditingMaterial(m); setShowMaterialModal(true); }}
                            onToggle={(m) => toggleMaterial.mutate({ id: m.id, ativo: !(m.ativo !== false) })}
                        />
                    </TabsContent>

                    {/* Importação Tab */}
                    <TabsContent value="importacao">
                        <ImportacaoMassa />
                    </TabsContent>

                    {/* Usuários Tab */}
                    <TabsContent value="usuarios">
                        <GestaoUsuarios />
                    </TabsContent>
                </Tabs>

                {/* Modal máquina/turno/parada/refugo */}
                <Dialog open={showModal} onOpenChange={setShowModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{getModalTitle()}</DialogTitle>
                        </DialogHeader>
                        {activeTab === 'machines' && (
                            <MachineForm machine={editingItem} categories={machineCategories} onSave={handleSave} onCancel={() => setShowModal(false)} />
                        )}
                        {activeTab === 'shifts' && (
                            <ShiftForm shift={editingItem} onSave={handleSave} onCancel={() => setShowModal(false)} />
                        )}
                        {activeTab === 'downtime' && (
                            <ReasonForm reason={editingItem} type="downtime" onSave={handleSave} onCancel={() => setShowModal(false)} />
                        )}
                        {activeTab === 'loss' && (
                            <ReasonForm reason={editingItem} type="loss" onSave={handleSave} onCancel={() => setShowModal(false)} />
                        )}
                    </DialogContent>
                </Dialog>

                {/* Modal matéria-prima */}
                <Dialog open={showMaterialModal} onOpenChange={setShowMaterialModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingMaterial ? 'Editar Matéria-Prima' : 'Nova Matéria-Prima'}</DialogTitle>
                        </DialogHeader>
                        <RawMaterialForm
                            material={editingMaterial}
                            onSave={(data) => saveMaterial.mutate(data)}
                            onCancel={() => { setShowMaterialModal(false); setEditingMaterial(null); }}
                        />
                    </DialogContent>
                </Dialog>

                {/* Modal produto */}
                <Dialog open={showProdModal} onOpenChange={setShowProdModal}>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingProduto ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label>Código *</Label>
                                    <Input value={prodForm.codigo} onChange={e => setProdForm(p => ({ ...p, codigo: e.target.value }))} placeholder="PROD-001" />
                                </div>
                                <div className="space-y-1">
                                    <Label>Nome *</Label>
                                    <Input value={prodForm.nome} onChange={e => setProdForm(p => ({ ...p, nome: e.target.value }))} placeholder="Telha PVC 200mm" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label>Categoria *</Label>
                                    <Select value={prodForm.categoria} onValueChange={v => {
                                        setProdForm(p => ({ ...p, categoria: v, unidade_producao: UNIDADES_POR_CATEGORIA[v] || 'UNIDADE' }));
                                        setCampoValores({});
                                    }}>
                                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                        <SelectContent>
                                            {CATEGORIAS_PRODUTO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label>Unidade Produção</Label>
                                    <Select value={prodForm.unidade_producao} onValueChange={v => setProdForm(p => ({ ...p, unidade_producao: v }))}>
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
                                <Textarea value={prodForm.notas} onChange={e => setProdForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observações..." />
                            </div>
                            {prodForm.categoria && (
                                <DynamicFields campos={camposAtivos} valores={campoValores} onChange={setCampoValores} />
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowProdModal(false)}>Cancelar</Button>
                            <Button onClick={handleSubmitProduto} disabled={createProduto.isPending || updateProduto.isPending} className="bg-blue-600 hover:bg-blue-700">
                                {editingProduto ? 'Salvar' : 'Criar Produto'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Modal campo de produto */}
                <Dialog open={showCampoModal} onOpenChange={setShowCampoModal}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editingCampo ? 'Editar Campo' : 'Novo Campo de Produto'}</DialogTitle>
                        </DialogHeader>
                        <CampoForm
                            campo={editingCampo}
                            onSave={(data) => saveCampo.mutate(data)}
                            onCancel={() => { setShowCampoModal(false); setEditingCampo(null); }}
                        />
                    </DialogContent>
                </Dialog>

                <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação removerá a categoria <strong>{categoryToDelete?.name}</strong> da lista local.
                                Máquinas que ainda usam essa categoria impedem a remoção.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDeleteMachineCategory}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}