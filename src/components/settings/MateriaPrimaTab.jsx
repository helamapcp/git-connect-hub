/**
 * Aba completa de Matérias-Primas com sub-abas:
 * - Lista de MP (CRUD)
 * - Categorias/Tipos (gestão dos tipos de MP)
 */
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, ToggleLeft, FlaskConical, Tag, Search, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

// Tipos padrão de matéria-prima
const TIPOS_PADRAO = ['PVC', 'Aditivo', 'Pigmento', 'Estabilizante', 'Plastificante', 'Outro'];

const TIPO_COLORS = {
    PVC: 'bg-blue-100 text-blue-700',
    Aditivo: 'bg-purple-100 text-purple-700',
    Pigmento: 'bg-pink-100 text-pink-700',
    Estabilizante: 'bg-orange-100 text-orange-700',
    Plastificante: 'bg-cyan-100 text-cyan-700',
    Outro: 'bg-slate-100 text-slate-600',
};

function getTipoColor(tipo) {
    return TIPO_COLORS[tipo] || 'bg-slate-100 text-slate-600';
}

export { TIPOS_PADRAO, getTipoColor };

export default function MateriaPrimaTab({ rawMaterials, onNew, onEdit, onToggle }) {
    const [search, setSearch] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [filterTipo, setFilterTipo] = useState('todos');

    // Contagem por tipo
    const contagemPorTipo = TIPOS_PADRAO.reduce((acc, tipo) => {
        acc[tipo] = rawMaterials.filter(m => m.tipo === tipo).length;
        return acc;
    }, {});

    const filtered = rawMaterials.filter(m => {
        const matchSearch = !search ||
            m.nome?.toLowerCase().includes(search.toLowerCase()) ||
            m.codigo?.toLowerCase().includes(search.toLowerCase());
        const matchTipo = filterTipo === 'todos' || m.tipo === filterTipo;
        const matchAtivo = showInactive || m.ativo !== false;
        return matchSearch && matchTipo && matchAtivo;
    });

    return (
        <Tabs defaultValue="lista">
            <TabsList className="mt-2 mb-4">
                <TabsTrigger value="lista" className="flex items-center gap-1.5">
                    <FlaskConical className="w-4 h-4" /> Matérias-Primas
                </TabsTrigger>
                <TabsTrigger value="categorias" className="flex items-center gap-1.5">
                    <Tag className="w-4 h-4" /> Categorias / Tipos
                </TabsTrigger>
            </TabsList>

            {/* ── Lista de MP ── */}
            <TabsContent value="lista">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
                        <CardTitle>Matérias-Primas ({rawMaterials.filter(m => m.ativo !== false).length} ativas)</CardTitle>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                <Switch checked={showInactive} onCheckedChange={setShowInactive} />
                                Mostrar inativas
                            </label>
                            <Button onClick={onNew} className="bg-amber-600 hover:bg-amber-700">
                                <Plus className="w-4 h-4 mr-2" /> Nova Matéria-Prima
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Filtros */}
                        <div className="flex flex-wrap gap-3 mb-4">
                            <div className="relative flex-1 min-w-48">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="Buscar por código ou nome..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <div className="flex flex-wrap gap-1">
                                <Button
                                    size="sm"
                                    variant={filterTipo === 'todos' ? 'default' : 'outline'}
                                    onClick={() => setFilterTipo('todos')}
                                    className="text-xs"
                                >
                                    Todos
                                </Button>
                                {TIPOS_PADRAO.map(tipo => (
                                    <Button
                                        key={tipo}
                                        size="sm"
                                        variant={filterTipo === tipo ? 'default' : 'outline'}
                                        onClick={() => setFilterTipo(tipo)}
                                        className="text-xs"
                                    >
                                        {tipo}
                                        {contagemPorTipo[tipo] > 0 && (
                                            <span className="ml-1 bg-slate-200 text-slate-700 rounded-full px-1.5 text-xs">
                                                {contagemPorTipo[tipo]}
                                            </span>
                                        )}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Tipo/Categoria</TableHead>
                                    <TableHead>Unidade</TableHead>
                                    <TableHead>Peso Saco</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-slate-400">
                                            Nenhuma matéria-prima encontrada
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.map(m => (
                                    <TableRow key={m.id} className={!m.ativo ? 'opacity-50' : ''}>
                                        <TableCell className="font-semibold font-mono text-sm">{m.codigo}</TableCell>
                                        <TableCell className="font-medium">{m.nome}</TableCell>
                                        <TableCell>
                                            <Badge className={cn('text-xs', getTipoColor(m.tipo))}>{m.tipo}</Badge>
                                        </TableCell>
                                        <TableCell>{m.unidade}</TableCell>
                                        <TableCell>
                                            {m.peso_saco_kg
                                                ? <span className="font-medium text-slate-700">{m.peso_saco_kg} kg</span>
                                                : <span className="text-slate-400">—</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={m.ativo !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                                                {m.ativo !== false ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => onEdit(m)}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost" size="icon"
                                                onClick={() => onToggle(m)}
                                                className={m.ativo !== false ? 'text-amber-600' : 'text-emerald-600'}
                                            >
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

            {/* ── Categorias / Tipos ── */}
            <TabsContent value="categorias">
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Tag className="w-5 h-5 text-amber-600" />
                                Categorias de Matéria-Prima
                            </CardTitle>
                            <p className="text-sm text-slate-500 mt-1">
                                Visão geral dos tipos/categorias utilizados para classificar as matérias-primas.
                            </p>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {TIPOS_PADRAO.map(tipo => {
                                    const mps = rawMaterials.filter(m => m.tipo === tipo);
                                    const ativas = mps.filter(m => m.ativo !== false);
                                    return (
                                        <div
                                            key={tipo}
                                            className="rounded-xl border p-4 space-y-3 hover:shadow-sm transition-shadow"
                                        >
                                            <div className="flex items-center justify-between">
                                                <Badge className={cn('text-sm px-3 py-1', getTipoColor(tipo))}>
                                                    {tipo}
                                                </Badge>
                                                <span className="text-2xl font-bold text-slate-800">{ativas.length}</span>
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {ativas.length} ativa{ativas.length !== 1 ? 's' : ''} · {mps.length} total
                                            </p>
                                            {/* Lista resumida das MPs desta categoria */}
                                            {ativas.length > 0 ? (
                                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                                    {ativas.map(m => (
                                                        <div key={m.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                                                            <span className="font-mono text-slate-500">{m.codigo}</span>
                                                            <span className="text-slate-700 truncate ml-2 flex-1 text-right">{m.nome}</span>
                                                            {m.peso_saco_kg && (
                                                                <span className="ml-2 text-slate-400 shrink-0">{m.peso_saco_kg}kg/sc</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">Nenhuma MP nesta categoria</p>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full text-xs"
                                                onClick={() => {/* placeholder - abre modal de nova MP com tipo preenchido */ }}
                                                disabled
                                            >
                                                <Plus className="w-3 h-3 mr-1" />
                                                Usar categoria ao criar MP
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600">
                                <p className="font-medium mb-1">ℹ️ Sobre as categorias</p>
                                <p>As categorias disponíveis são: <strong>PVC, Aditivo, Pigmento, Estabilizante, Plastificante, Outro</strong>. Ao cadastrar uma nova matéria-prima, selecione a categoria correspondente no formulário.</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tabela resumo por categoria */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Resumo por Categoria</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Categoria</TableHead>
                                        <TableHead className="text-center">Total MPs</TableHead>
                                        <TableHead className="text-center">Ativas</TableHead>
                                        <TableHead className="text-center">Inativas</TableHead>
                                        <TableHead>Com Peso de Saco</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {TIPOS_PADRAO.map(tipo => {
                                        const mps = rawMaterials.filter(m => m.tipo === tipo);
                                        const ativas = mps.filter(m => m.ativo !== false);
                                        const inativas = mps.filter(m => m.ativo === false);
                                        const comPeso = ativas.filter(m => m.peso_saco_kg);
                                        return (
                                            <TableRow key={tipo}>
                                                <TableCell>
                                                    <Badge className={cn('text-xs', getTipoColor(tipo))}>{tipo}</Badge>
                                                </TableCell>
                                                <TableCell className="text-center font-bold">{mps.length}</TableCell>
                                                <TableCell className="text-center">
                                                    <span className={cn('font-medium', ativas.length > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                                                        {ativas.length}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className={cn('text-slate-500', inativas.length > 0 ? 'text-amber-600' : '')}>
                                                        {inativas.length}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {comPeso.length > 0
                                                        ? <span className="text-sm text-slate-700">{comPeso.length} de {ativas.length}</span>
                                                        : <span className="text-slate-400 text-xs">nenhuma</span>}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>
    );
}