import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
    Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle,
    Download, ChevronDown, ChevronUp, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Configuração dos tipos de importação ─────────────────────────────────────
const IMPORT_TYPES = [
    {
        id: 'produtos',
        label: 'Produtos',
        description: 'Importe produtos em massa (código, nome, categoria, unidade)',
        queryKey: 'settings-produtos',
        templateHeaders: ['codigo', 'nome', 'categoria', 'unidade_producao', 'notas'],
        templateExample: [
            ['TELHA-001', 'Telha PVC 200mm', 'TELHA', 'UNIDADE', ''],
            ['FORRO-001', 'Forro PVC 8mm', 'FORRO', 'CAIXA', 'Observação'],
        ],
        requiredFields: ['codigo', 'nome', 'categoria'],
        validValues: { categoria: ['TELHA', 'FORRO', 'CUMEEIRA', 'PORTA', 'ACABAMENTO'], unidade_producao: ['UNIDADE', 'CAIXA', 'metros', 'kg'] },
        transform: (row) => ({ ...row, ativo: true }),
        entity: 'Produto',
    },
    {
        id: 'ordens',
        label: 'Ordens de Produção',
        description: 'Importe ordens de produção em lote',
        queryKey: 'orders',
        templateHeaders: ['order_number', 'product_code', 'product_name', 'quantity_planned', 'categoria_processo', 'unidade_producao', 'priority', 'notes'],
        templateExample: [
            ['OP-2024-001', 'TELHA-001', 'Telha PVC 200mm', '1000', 'TELHA', 'UNIDADE', 'normal', ''],
            ['OP-2024-002', 'FORRO-001', 'Forro PVC 8mm', '500', 'FORRO', 'CAIXA', 'high', 'Urgente'],
        ],
        requiredFields: ['order_number', 'product_code', 'product_name', 'quantity_planned'],
        validValues: { categoria_processo: ['TELHA', 'FORRO', 'CUMEEIRA', 'PORTA', 'ACABAMENTO'], priority: ['low', 'normal', 'high', 'urgent'] },
        transform: (row) => ({ ...row, quantity_planned: parseFloat(row.quantity_planned) || 0, status: 'LIBERADA', active: true }),
        entity: 'ProductionOrder',
    },
    {
        id: 'maquinas',
        label: 'Máquinas',
        description: 'Importe máquinas e equipamentos',
        queryKey: 'settings-machines',
        templateHeaders: ['code', 'name', 'type', 'sector'],
        templateExample: [
            ['EXT-001', 'Extrusora Principal', 'extrusora', 'Setor A'],
            ['INJ-001', 'Injetora 1', 'injetora', 'Setor B'],
        ],
        requiredFields: ['code', 'name', 'type'],
        validValues: { type: ['extrusora', 'injetora', 'cortadeira', 'embaladora'] },
        transform: (row) => ({ ...row, status: 'available', active: true }),
        entity: 'Machine',
    },
    {
        id: 'paradas',
        label: 'Motivos de Parada',
        description: 'Importe motivos de parada de máquina',
        queryKey: 'settings-downtime-reasons',
        templateHeaders: ['code', 'name', 'category', 'description'],
        templateExample: [
            ['PAR-001', 'Falta de Material', 'unplanned', ''],
            ['PAR-002', 'Manutenção Preventiva', 'maintenance', 'Manutenção planejada'],
        ],
        requiredFields: ['code', 'name', 'category'],
        validValues: { category: ['planned', 'unplanned', 'maintenance', 'setup', 'quality'] },
        transform: (row) => ({ ...row, active: true }),
        entity: 'DowntimeReason',
    },
    {
        id: 'refugos',
        label: 'Motivos de Refugo',
        description: 'Importe motivos de refugo/perda',
        queryKey: 'settings-loss-reasons',
        templateHeaders: ['code', 'name', 'category', 'description'],
        templateExample: [
            ['REF-001', 'Defeito de Material', 'material', ''],
            ['REF-002', 'Erro de Processo', 'process', ''],
        ],
        requiredFields: ['code', 'name', 'category'],
        validValues: { category: ['material', 'process', 'equipment', 'operator', 'quality'] },
        transform: (row) => ({ ...row, active: true }),
        entity: 'LossReason',
    },
];

// ─── Helpers CSV ───────────────────────────────────────────────────────────────
function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row = {};
        headers.forEach((h, i) => { row[h] = values[i] || ''; });
        return row;
    });
}

function generateCSV(headers, rows) {
    const lines = [headers.join(',')];
    rows.forEach(row => lines.push(row.map(v => `"${v}"`).join(',')));
    return lines.join('\n');
}

function downloadCSV(filename, content) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

// ─── Validação ────────────────────────────────────────────────────────────────
function validateRows(rows, config) {
    return rows.map((row, idx) => {
        const errors = [];
        config.requiredFields.forEach(f => {
            if (!row[f]) errors.push(`Campo "${f}" obrigatório`);
        });
        Object.entries(config.validValues || {}).forEach(([field, valid]) => {
            if (row[field] && !valid.includes(row[field])) {
                errors.push(`"${row[field]}" inválido para ${field}. Válidos: ${valid.join(', ')}`);
            }
        });
        return { row, idx: idx + 2, errors, valid: errors.length === 0 };
    });
}

// ─── ImportCard ───────────────────────────────────────────────────────────────
function ImportCard({ config }) {
    const queryClient = useQueryClient();
    const fileRef = useRef();
    const [parsed, setParsed] = useState(null);   // { valid, invalid, rows }
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);   // { success, failed }
    const [showPreview, setShowPreview] = useState(false);
    const [dragging, setDragging] = useState(false);

    const handleDownloadTemplate = () => {
        const csv = generateCSV(config.templateHeaders, config.templateExample);
        downloadCSV(`template_${config.id}.csv`, csv);
    };

    const processFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const rows = parseCSV(e.target.result);
            if (rows.length === 0) { toast.error('Arquivo vazio ou formato inválido'); return; }
            const validated = validateRows(rows, config);
            setParsed({
                all: validated,
                valid: validated.filter(r => r.valid),
                invalid: validated.filter(r => !r.valid),
            });
            setResult(null);
            setShowPreview(true);
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleFile = (e) => processFile(e.target.files[0]);
    const handleDrop = (e) => {
        e.preventDefault(); setDragging(false);
        processFile(e.dataTransfer.files[0]);
    };

    const handleImport = async () => {
        if (!parsed?.valid.length) return;
        setImporting(true);
        let success = 0, failed = 0;
        const entity = base44.entities[config.entity];
        for (const { row } of parsed.valid) {
            try {
                await entity.create(config.transform(row));
                success++;
            } catch {
                failed++;
            }
        }
        setImporting(false);
        setResult({ success, failed });
        queryClient.invalidateQueries([config.queryKey]);
        if (success > 0) toast.success(`${success} registro(s) importado(s) com sucesso!`);
        if (failed > 0) toast.error(`${failed} registro(s) falharam.`);
        setParsed(null);
        setShowPreview(false);
        if (fileRef.current) fileRef.current.value = '';
    };

    const reset = () => {
        setParsed(null); setResult(null); setShowPreview(false);
        if (fileRef.current) fileRef.current.value = '';
    };

    return (
        <Card className="border border-slate-200">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-base">{config.label}</CardTitle>
                        <CardDescription className="text-sm mt-0.5">{config.description}</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="shrink-0 ml-3">
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Template CSV
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Drop zone */}
                {!parsed && !result && (
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileRef.current?.click()}
                        className={cn(
                            "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all",
                            dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        )}
                    >
                        <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        <p className="text-sm font-medium text-slate-700">Arraste um arquivo CSV ou clique para selecionar</p>
                        <p className="text-xs text-slate-400 mt-1">Somente arquivos .csv</p>
                        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
                    </div>
                )}

                {/* Preview */}
                {parsed && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            <Badge className="bg-emerald-100 text-emerald-700">{parsed.valid.length} válidos</Badge>
                            {parsed.invalid.length > 0 && (
                                <Badge className="bg-red-100 text-red-600">{parsed.invalid.length} com erro</Badge>
                            )}
                            <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setShowPreview(p => !p)}>
                                {showPreview ? <><ChevronUp className="w-3.5 h-3.5 mr-1" />Ocultar</> : <><ChevronDown className="w-3.5 h-3.5 mr-1" />Visualizar</>}
                            </Button>
                        </div>

                        {showPreview && (
                            <div className="max-h-48 overflow-y-auto border rounded-lg text-xs">
                                <table className="w-full">
                                    <thead className="bg-slate-50 sticky top-0">
                                        <tr>
                                            <th className="px-2 py-1.5 text-left font-medium text-slate-500 w-10">Linha</th>
                                            {config.templateHeaders.map(h => (
                                                <th key={h} className="px-2 py-1.5 text-left font-medium text-slate-500">{h}</th>
                                            ))}
                                            <th className="px-2 py-1.5 text-left font-medium text-slate-500">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsed.all.map(({ row, idx, errors, valid }) => (
                                            <tr key={idx} className={cn("border-t", !valid && "bg-red-50")}>
                                                <td className="px-2 py-1 text-slate-400">{idx}</td>
                                                {config.templateHeaders.map(h => (
                                                    <td key={h} className="px-2 py-1 truncate max-w-[100px]" title={row[h]}>{row[h] || '-'}</td>
                                                ))}
                                                <td className="px-2 py-1">
                                                    {valid
                                                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                        : <span className="text-red-500 text-xs">{errors[0]}</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {parsed.invalid.length > 0 && (
                            <Alert className="border-amber-300 bg-amber-50 py-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <AlertDescription className="text-amber-800 text-xs">
                                    {parsed.invalid.length} linha(s) serão ignoradas por conter erros de validação.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={reset} disabled={importing}>Cancelar</Button>
                            <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={handleImport}
                                disabled={importing || parsed.valid.length === 0}
                            >
                                {importing
                                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Importando...</>
                                    : <><Upload className="w-3.5 h-3.5 mr-1.5" />Importar {parsed.valid.length} registro(s)</>}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Result */}
                {result && (
                    <div className="space-y-2">
                        <div className="flex gap-3">
                            {result.success > 0 && (
                                <div className="flex items-center gap-1.5 text-emerald-700 text-sm">
                                    <CheckCircle2 className="w-4 h-4" /> {result.success} importados
                                </div>
                            )}
                            {result.failed > 0 && (
                                <div className="flex items-center gap-1.5 text-red-600 text-sm">
                                    <XCircle className="w-4 h-4" /> {result.failed} falharam
                                </div>
                            )}
                        </div>
                        <Button variant="outline" size="sm" onClick={reset}>Nova importação</Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ImportacaoMassa() {
    return (
        <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                <p className="font-semibold mb-1">Como funciona a importação em massa</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                    <li>Baixe o template CSV de cada categoria</li>
                    <li>Preencha os dados seguindo o formato do template</li>
                    <li>Faça o upload do arquivo preenchido</li>
                    <li>Verifique o preview e confirme a importação</li>
                </ul>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {IMPORT_TYPES.map(config => (
                    <ImportCard key={config.id} config={config} />
                ))}
            </div>
        </div>
    );
}