import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, ArrowRight, Package } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import StockLocalBase from './StockLocalBase.jsx';
import TransferenciaPCPModal from './TransferenciaPCPModal.jsx';

export default function EstoquePCP() {
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    const [showTransfModal, setShowTransfModal] = useState(false);

    useEffect(() => { base44.auth.me().then(setUser).catch(() => { }); }, []);

    const { data: balancesPCP = [] } = useQuery({
        queryKey: ['stock-balances', 'PCP'],
        queryFn: async () => {
            const all = await base44.entities.StockBalance.list();
            return all.filter(b => b.local === 'PCP');
        },
        refetchInterval: 15000,
    });

    const { data: balancesPMP = [] } = useQuery({
        queryKey: ['stock-balances', 'PMP'],
        queryFn: async () => {
            const all = await base44.entities.StockBalance.list();
            return all.filter(b => b.local === 'PMP');
        },
        refetchInterval: 15000,
    });

    const { data: transferencias = [] } = useQuery({
        queryKey: ['transferencias-pcp'],
        queryFn: () => base44.entities.TransferenciaPCP.filter({ active: true }),
        refetchInterval: 15000,
    });

    const totalPCP = balancesPCP.reduce((s, b) => s + (b.quantidade_kg || 0), 0);

    return (
        <div>
            <div className="mt-4 mb-2 flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                <ClipboardList className="w-5 h-5 text-indigo-600 shrink-0" />
                <p className="text-indigo-700 text-sm">
                    <strong>PCP — Planejamento e Controle da Produção:</strong> Recebe MP do CD e transfere para a PMP com base nas formulações. A transferência calcula os sacos necessários descontando o saldo já existente na PMP.
                </p>
            </div>

            <Tabs defaultValue="estoque">
                <TabsList className="mt-4">
                    <TabsTrigger value="estoque">Estoque PCP</TabsTrigger>
                    <TabsTrigger value="transferencias">Histórico de Transferências</TabsTrigger>
                </TabsList>

                <TabsContent value="estoque">
                    {/* Botão de transferência por formulação */}
                    <div className="mt-4 mb-2 flex justify-end">
                        <Button onClick={() => setShowTransfModal(true)} className="bg-indigo-600 hover:bg-indigo-700">
                            <ArrowRight className="w-4 h-4 mr-1" /> Transferir para PMP por Formulação
                        </Button>
                    </div>
                    <StockLocalBase
                        local="PCP"
                        allowedEntryTypes={['saida']}
                        transferDestinos={[]}
                    />
                </TabsContent>

                <TabsContent value="transferencias">
                    <div className="space-y-4 mt-4">
                        {transferencias.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center text-slate-400">
                                    <ArrowRight className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p>Nenhuma transferência registrada</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-2">
                                {[...transferencias].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).map(t => {
                                    const itens = (() => { try { return JSON.parse(t.itens || '[]'); } catch { return []; } })();
                                    const comTransf = itens.filter(i => i.qtd_transferida_kg > 0);
                                    return (
                                        <Card key={t.id}>
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-bold text-slate-900">{t.numero}</span>
                                                            <Badge className="bg-indigo-100 text-indigo-700">{t.formulacao_nome}</Badge>
                                                            <Badge variant="outline">{t.num_bateladas} bat. • {t.misturador}</Badge>
                                                            <Badge className="bg-emerald-100 text-emerald-700">Confirmada</Badge>
                                                        </div>
                                                        <p className="text-xs text-slate-400 mt-1">
                                                            {t.data_transferencia ? format(new Date(t.data_transferencia), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—'}
                                                            {t.operator_name && ` • ${t.operator_name}`}
                                                        </p>
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {comTransf.map((item, i) => (
                                                                <span key={i} className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5">
                                                                    {item.material_nome}: {item.qtd_transferida_kg.toFixed(2)} kg
                                                                    {item.sacos_novos > 0 && ` (${item.sacos_novos} saco${item.sacos_novos > 1 ? 's' : ''})`}
                                                                </span>
                                                            ))}
                                                            {comTransf.length === 0 && (
                                                                <span className="text-xs text-emerald-600 italic">Coberta pelo saldo PMP — sem transferência física</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-xs text-slate-400">Total transferido</p>
                                                        <p className="font-bold text-blue-700">{(t.total_transferido_kg || 0).toFixed(2)} kg</p>
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

            {showTransfModal && (
                <TransferenciaPCPModal
                    balancesPCP={balancesPCP}
                    balancesPMP={balancesPMP}
                    queryClient={queryClient}
                    user={user}
                    onClose={() => setShowTransfModal(false)}
                    onSuccess={() => { }}
                />
            )}
        </div>
    );
}