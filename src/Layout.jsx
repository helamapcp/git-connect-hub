import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    LayoutDashboard, Factory, Package, Settings, LogOut,
    Menu, X, ChevronRight, Warehouse, History, Boxes, FlaskConical
} from "lucide-react";
import { cn } from "@/lib/utils";
import RouteGuard from "@/components/auth/RouteGuard";

const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard', roles: ['admin', 'gerente', 'supervisor', 'pcp'] },
    { name: 'Produção', icon: Factory, page: 'MachineSelection', roles: ['admin', 'gerente', 'supervisor', 'pcp', 'operador'] },
    { name: 'Ordens', icon: Package, page: 'Orders', roles: ['admin', 'gerente', 'supervisor', 'pcp'] },
    { name: 'Fábrica', icon: Warehouse, page: 'FactoryDashboard', roles: ['admin', 'gerente', 'supervisor', 'pcp', 'operador'] },
    { name: 'Estoque', icon: Boxes, page: 'Estoque', roles: ['admin', 'gerente', 'supervisor', 'pcp'] },
    { name: 'Planej. Composto', icon: FlaskConical, page: 'PlanejamentoComposto', roles: ['admin', 'gerente', 'supervisor', 'pcp'] },
    { name: 'Histórico Consumo', icon: History, page: 'ConsumptionHistory', roles: ['admin', 'gerente', 'supervisor', 'pcp'] },
    { name: 'Configurações', icon: Settings, page: 'Settings', roles: ['admin', 'gerente'] },
];

const ROLE_LABEL = {
    admin: { label: 'Admin', color: 'bg-red-100 text-red-700' },
    gerente: { label: 'Gerente', color: 'bg-purple-100 text-purple-700' },
    supervisor: { label: 'Supervisor', color: 'bg-blue-100 text-blue-700' },
    pcp: { label: 'PCP', color: 'bg-indigo-100 text-indigo-700' },
    operador: { label: 'Operador', color: 'bg-emerald-100 text-emerald-700' },
};

export default function Layout({ children, currentPageName }) {
    const [user, setUser] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
        base44.auth.me().then(setUser).catch(() => { });
    }, []);

    const userRole = user?.role || '';
    const isOperador = userRole === 'operador' || userRole?.startsWith('inactive_');
    const filteredNavItems = navItems.filter(item => item.roles.includes(userRole));

    const handleLogout = () => {
        base44.auth.logout();
    };

    // No sidebar for Production/factory floor pages or operador role  
    const FACTORY_FLOOR_PAGES = ['Production', 'BagTransfer', 'MachineConsumption'];
    const noSidebar = FACTORY_FLOOR_PAGES.includes(currentPageName) || isOperador;

    return (
        <RouteGuard currentPageName={currentPageName}>
            {noSidebar ? children : (
                <div className="min-h-screen bg-slate-50">
                    {/* Mobile Header */}
                    <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                            >
                                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </Button>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                                    <Factory className="w-4 h-4 text-white" />
                                </div>
                                <span className="font-bold text-slate-900">PVC Production</span>
                            </div>
                        </div>
                        {user && (
                            <div className="text-right">
                                <p className="text-sm font-medium text-slate-900">{user.full_name}</p>
                                <p className="text-xs text-slate-500 capitalize">{userRole}</p>
                            </div>
                        )}
                    </header>

                    {/* Sidebar */}
                    <aside className={cn(
                        "fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-40 transition-transform duration-300",
                        "lg:translate-x-0",
                        sidebarOpen ? "translate-x-0" : "-translate-x-full"
                    )}>
                        {/* Logo */}
                        <div className="h-16 px-6 flex items-center border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
                                    <Factory className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="font-bold text-slate-900">PVC Production</h1>
                                    <p className="text-xs text-slate-500">Sistema de Apontamento</p>
                                </div>
                            </div>
                        </div>

                        {/* Navigation */}
                        <nav className="p-4 space-y-1">
                            {filteredNavItems.map((item) => {
                                const isActive = currentPageName === item.page;
                                const Icon = item.icon;

                                return (
                                    <Link
                                        key={item.page}
                                        to={createPageUrl(item.page)}
                                        onClick={() => setSidebarOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                                            "hover:bg-slate-100",
                                            isActive && "bg-blue-50 text-blue-700 font-medium"
                                        )}
                                    >
                                        <Icon className={cn(
                                            "w-5 h-5",
                                            isActive ? "text-blue-600" : "text-slate-500"
                                        )} />
                                        <span className={cn(
                                            isActive ? "text-blue-700" : "text-slate-700"
                                        )}>
                                            {item.name}
                                        </span>
                                        {isActive && (
                                            <ChevronRight className="w-4 h-4 ml-auto text-blue-400" />
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* User Section */}
                        {user && (
                            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-medium">
                                        {user.full_name?.charAt(0) || 'U'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">{user.full_name}</p>
                                        <Badge className={`text-xs mt-0.5 ${ROLE_LABEL[userRole]?.color || 'bg-slate-100 text-slate-600'}`}>
                                            {ROLE_LABEL[userRole]?.label || userRole}
                                        </Badge>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start text-slate-600"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Sair
                                </Button>
                            </div>
                        )}
                    </aside>

                    {/* Overlay */}
                    {sidebarOpen && (
                        <div
                            className="lg:hidden fixed inset-0 bg-black/50 z-30"
                            onClick={() => setSidebarOpen(false)}
                        />
                    )}

                    {/* Main Content */}
                    <main className={cn(
                        "lg:ml-64 min-h-screen",
                        "pt-16 lg:pt-0"
                    )}>
                        {children}
                    </main>
                </div>
            )}
        </RouteGuard>
    );
}