import React from 'react';
import { Factory } from 'lucide-react';
import StockLocalBase from './StockLocalBase.jsx';

export default function EstoqueFabrica() {
    return (
        <div>
            <div className="mt-4 mb-2 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <Factory className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-emerald-700 text-sm">
                    <strong>Fábrica:</strong> Recebe o composto produzido na PMP via sacolas. O consumo é registrado via módulo de Consumo de Máquina.
                </p>
            </div>
            <StockLocalBase
                local="FÁBRICA"
                allowedEntryTypes={['saida']}
                transferDestinos={[]}
            />
        </div>
    );
}