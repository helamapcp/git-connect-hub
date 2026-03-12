import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    LayoutDashboard, Factory, Package, Settings, LogOut,
    Menu, X, ChevronRight, Warehouse, History, Boxes, FlaskConical
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Produção', icon: Factory, page: 'MachineSelection' },
    { name: 'Ordens', icon: Package, page: 'Orders' },
    { name: 'PA & Logística', icon: Package, page: 'PATracking' },
    { name: 'Fábrica', icon: Warehouse, page: 'FactoryDashboard' },
    { name: 'Estoque', icon: Boxes, page: 'Estoque' },
    { name: 'Planej. Composto', icon: FlaskConical, page: 'PlanejamentoComposto' },
    { name: 'Histórico Consumo', icon: History, page: 'ConsumptionHistory' },
    { name: 'Configurações', icon: Settings, page: 'Settings' },
];

const mockUser = {
    full_name: 'Frontend Local',
    role: 'admin'
};

export default function Layout({ children, currentPageName }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        window.location.href = '/';
    };

    // No sidebar for production floor pages
    const FACTORY_FLOOR_PAGES = ['Production', 'BagTransfer', 'MachineConsumption'];
    const noSidebar = FACTORY_FLOOR_PAGES.includes(currentPageName);

    return (
        noSidebar ? children : (
            <div className="min-h-screen bg-background text-foreground">
                {/* Mobile Header */}
                <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-background border-b border-border z-50 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </Button>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                                <Factory className="w-4 h-4 text-primary-foreground" />
                            </div>
                            <span className="font-bold">PVC Production</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-medium">{mockUser.full_name}</p>
                        <p className="text-xs text-muted-foreground">{mockUser.role}</p>
                    </div>
                </header>

                {/* Sidebar */}
                <aside className={cn(
                    "fixed top-0 left-0 h-full w-64 bg-background border-r border-border z-40 transition-transform duration-300",
                    "lg:translate-x-0",
                    sidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}>
                    <div className="h-16 px-6 flex items-center border-b border-border">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
                                <Factory className="w-5 h-5 text-primary-foreground" />
                            </div>
                            <div>
                                <h1 className="font-bold">PVC Production</h1>
                                <p className="text-xs text-muted-foreground">Modo Frontend</p>
                            </div>
                        </div>
                    </div>

                    <nav className="p-4 space-y-1">
                        {navItems.map((item) => {
                            const isActive = currentPageName === item.page;
                            const Icon = item.icon;

                            return (
                                <Link
                                    key={item.page}
                                    to={createPageUrl(item.page)}
                                    onClick={() => setSidebarOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                                        "hover:bg-muted",
                                        isActive && "bg-muted font-medium"
                                    )}
                                >
                                    <Icon className={cn("w-5 h-5", isActive ? "text-foreground" : "text-muted-foreground")} />
                                    <span>{item.name}</span>
                                    {isActive && (
                                        <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-medium">
                                {mockUser.full_name?.charAt(0) || 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{mockUser.full_name}</p>
                                <Badge variant="secondary" className="text-xs mt-0.5">{mockUser.role}</Badge>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full justify-start"
                            onClick={handleLogout}
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Voltar ao preview
                        </Button>
                    </div>
                </aside>

                {sidebarOpen && (
                    <div
                        className="lg:hidden fixed inset-0 bg-black/50 z-30"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                <main className={cn("lg:ml-64 min-h-screen", "pt-16 lg:pt-0")}>
                    {children}
                </main>
            </div>
        )
    );
}
