import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Sun, Moon, Sunrise } from "lucide-react";
import { cn } from "@/lib/utils";

const shiftIcons = {
    '1': Sun,
    '2': Sunset,
    '3': Moon
};

function Sunset(props) {
    return <Sunrise {...props} />;
}

export default function ShiftSelector({
    open,
    onClose,
    onSelect,
    shifts = [],
    selectedShift = null
}) {
    const [selected, setSelected] = React.useState(selectedShift);

    const handleConfirm = () => {
        if (selected) {
            onSelect(selected);
            onClose();
        }
    };

    const getShiftIcon = (index) => {
        const icons = [Sun, Sunrise, Moon];
        return icons[index % 3];
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-blue-600" />
                        </div>
                        Selecionar Turno
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-3">
                    {shifts.map((shift, index) => {
                        const Icon = getShiftIcon(index);
                        return (
                            <button
                                key={shift.id}
                                onClick={() => setSelected(shift)}
                                className={cn(
                                    "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all",
                                    "hover:shadow-md active:scale-[0.98]",
                                    selected?.id === shift.id
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-slate-200 bg-white hover:border-slate-300"
                                )}
                            >
                                <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center",
                                    selected?.id === shift.id ? "bg-blue-100" : "bg-slate-100"
                                )}>
                                    <Icon className={cn(
                                        "w-6 h-6",
                                        selected?.id === shift.id ? "text-blue-600" : "text-slate-500"
                                    )} />
                                </div>
                                <div className="text-left flex-1">
                                    <p className="font-semibold text-slate-900">{shift.name}</p>
                                    <p className="text-sm text-slate-500">
                                        {shift.start_time} - {shift.end_time}
                                    </p>
                                </div>
                                <div className={cn(
                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                                    selected?.id === shift.id
                                        ? "border-blue-500 bg-blue-500"
                                        : "border-slate-300"
                                )}>
                                    {selected?.id === shift.id && (
                                        <div className="w-2 h-2 rounded-full bg-white" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                <DialogFooter className="gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 h-12"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selected}
                        className="flex-1 h-12 font-semibold bg-blue-600 hover:bg-blue-700"
                    >
                        Confirmar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}