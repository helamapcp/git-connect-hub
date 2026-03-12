import React from 'react';

// Frontend-only mode: all routes are allowed without auth checks.
export const HOME_BY_ROLE = {
    admin: 'Dashboard',
    gerente: 'Dashboard',
    supervisor: 'Dashboard',
    pcp: 'Dashboard',
    operador: 'MachineSelection',
};

export default function RouteGuard({ children }) {
    return children;
}
