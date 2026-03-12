import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Loader2 } from 'lucide-react';

// Mapa de permissões por página e role
const PAGE_ROLES = {
    Dashboard: ['admin', 'gerente', 'supervisor', 'pcp'],
    Orders: ['admin', 'gerente', 'supervisor', 'pcp'],
    Settings: ['admin', 'gerente'],
    MachineSelection: ['admin', 'gerente', 'supervisor', 'pcp', 'operador'],
    Production: ['admin', 'gerente', 'supervisor', 'pcp', 'operador'],
    FactoryDashboard: ['admin', 'gerente', 'supervisor', 'pcp', 'operador'],
    BagTransfer: ['admin', 'gerente', 'supervisor', 'pcp', 'operador'],
    MachineConsumption: ['admin', 'gerente', 'supervisor', 'pcp', 'operador'],
    BagInventory: ['admin', 'gerente', 'supervisor', 'pcp'],
    ConsumptionHistory: ['admin', 'gerente', 'supervisor', 'pcp'],
    Estoque: ['admin', 'gerente', 'supervisor', 'pcp'],
    PlanejamentoComposto: ['admin', 'gerente', 'supervisor', 'pcp'],
};

// Página padrão por role após login
export const HOME_BY_ROLE = {
    admin: 'Dashboard',
    gerente: 'Dashboard',
    supervisor: 'Dashboard',
    pcp: 'Dashboard',
    operador: 'MachineSelection',
};

export default function RouteGuard({ children, currentPageName }) {
    const [status, setStatus] = useState('loading');
    const [user, setUser] = useState(null);

    useEffect(() => {
        base44.auth.me()
            .then(u => {
                setUser(u);
                const role = u?.role || 'operador';

                // Block inactive users
                if (u?.active === false) {
                    setStatus('inactive');
                    return;
                }

                const allowed = PAGE_ROLES[currentPageName];
                if (!allowed || allowed.includes(role)) {
                    setStatus('allowed');
                } else {
                    // Auto-redirect to the correct home for this role
                    const home = HOME_BY_ROLE[role] || 'MachineSelection';
                    window.location.href = createPageUrl(home);
                }
            })
            .catch(() => {
                setStatus('unauthenticated');
            });
    }, [currentPageName]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (status === 'unauthenticated') {
        base44.auth.redirectToLogin(window.location.href);
        return null;
    }

    if (status === 'inactive') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                <div className="text-6xl">🚫</div>
                <h1 className="text-2xl font-bold text-slate-800">Conta desativada</h1>
                <p className="text-slate-500">Sua conta está inativa. Entre em contato com o administrador.</p>
                <button
                    onClick={() => base44.auth.logout()}
                    className="mt-2 px-6 py-3 bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-800"
                >
                    Sair
                </button>
            </div>
        );
    }

    return children;
}