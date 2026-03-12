import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Truck } from 'lucide-react';
import StockLocalBase from './StockLocalBase.jsx';

export default function EstoqueCD() {
    return (
        <div>
            <div className="mt-4 mb-2 flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <Truck className="w-5 h-5 text-blue-600 shrink-0" />
                <p className="text-blue-700 text-sm">
                    <strong>CD — Central de Distribuição:</strong> Ponto de recebimento da matéria-prima. Registre aqui as entradas de fornecedores e transfira para o PCP.
                </p>
            </div>
            <StockLocalBase
                local="CD"
                allowedEntryTypes={['entrada', 'saida']}
                transferDestinos={['PCP']}
            />
        </div>
    );
}