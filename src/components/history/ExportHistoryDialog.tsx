"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarIcon, Download, Loader2, FileSpreadsheet } from "lucide-react";
import { getAccessEvents } from "@/app/actions/history";
import ExcelJS from "exceljs";

interface ExportHistoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ExportHistoryDialog({ open, onOpenChange }: ExportHistoryDialogProps) {
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            // Fetch ALL data for the period (no pagination)
            const response = await getAccessEvents({
                from: new Date(startDate + "T00:00:00"),
                to: new Date(endDate + "T23:59:59"),
                take: 10000, // Limit to 10k for safety
                skip: 0
            });

            const events = response.events;

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Historial de Accesos");

            // Define columns
            worksheet.columns = [
                { header: "ID de Evento", key: "id", width: 25 },
                { header: "Fecha", key: "date", width: 15 },
                { header: "Hora", key: "time", width: 15 },
                { header: "Matrícula", key: "plate", width: 15 },
                { header: "Tipo de Acceso", key: "type", width: 15 },
                { header: "Sujeto / Residente", key: "user", width: 30 },
                { header: "Unidad / Lote", key: "unit", width: 20 },
                { header: "Departamento", key: "apartment", width: 15 },
                { header: "Punto de Acceso", key: "device", width: 25 },
                { header: "Sentido", key: "direction", width: 12 },
                { header: "Resultado", key: "decision", width: 15 },
                { header: "Detalles Técnicos", key: "details", width: 40 },
            ];

            // Style headers
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
            headerRow.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFC52828" } // Red-600
            };
            headerRow.alignment = { vertical: "middle", horizontal: "center" };

            // Add rows
            events.forEach((e: any, index: number) => {
                const timestamp = new Date(e.timestamp);
                const row = worksheet.addRow({
                    id: e.id,
                    date: timestamp.toLocaleDateString(),
                    time: timestamp.toLocaleTimeString(),
                    plate: e.plateDetected || "-------",
                    type: e.accessType === "PLATE" ? "LPR" : e.accessType === "FACE" ? "Facial" : "TAG",
                    user: e.user?.name || "Externo / Desconocido",
                    unit: e.user?.unit?.name || "---",
                    apartment: e.user?.apartment || "---",
                    device: e.device?.name || "Nodo LPR",
                    direction: e.device?.direction === "ENTRY" ? "Entrada" : "Salida",
                    decision: e.decision === "GRANT" ? "PERMITIDO" : "DENEGADO",
                    details: e.details || ""
                });

                // Row height
                row.height = 20;
                row.alignment = { vertical: 'middle' };

                // Zebra stripes
                if (index % 2 === 0) {
                    row.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF9FAFB' } // Very light gray (neutral-50)
                    };
                }

                // Add borders to cells
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                    };
                });

                // Conditional styling for Decision
                const decisionCell = row.getCell("decision");
                if (e.decision === "GRANT") {
                    decisionCell.font = { color: { argb: "FF059669" }, bold: true }; // Emerald-600
                } else {
                    decisionCell.font = { color: { argb: "FFDC2626" }, bold: true }; // Red-600
                }

                // Center specific columns
                ['date', 'time', 'plate', 'type', 'direction', 'decision'].forEach(key => {
                    row.getCell(key).alignment = { horizontal: 'center', vertical: 'middle' };
                });
            });

            // Auto-filter
            worksheet.autoFilter = "A1:L1";

            // Generate buffer and download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `Historial_OmniAccess_${startDate}_a_${endDate}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);

            onOpenChange(false);
        } catch (error) {
            console.error("Export error:", error);
            alert("Error al exportar los datos.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-neutral-900 border-neutral-800 text-white">
                <DialogHeader>
                    <div className="mx-auto w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                        <FileSpreadsheet className="text-red-500" size={24} />
                    </div>
                    <DialogTitle className="text-xl font-black text-center uppercase tracking-tight">Exportar Reporte</DialogTitle>
                    <DialogDescription className="text-neutral-500 text-center text-xs font-medium">
                        Selecciona el rango de fechas para generar el reporte de accesos en formato Excel.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-black text-neutral-500 tracking-widest pl-1">Desde</Label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={14} />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg h-10 pl-9 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 uppercase appearance-none"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-black text-neutral-500 tracking-widest pl-1">Hasta</Label>
                            <div className="relative">
                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={14} />
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg h-10 pl-9 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 uppercase appearance-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                        <p className="text-[10px] text-neutral-400 leading-relaxed italic text-center">
                            El archivo incluirá todos los eventos registrados dentro del periodo seleccionado, incluyendo detalles de vehículos y residentes.
                        </p>
                    </div>
                </div>

                <DialogFooter className="sm:justify-center">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-white"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-widest h-10 px-8 shadow-lg shadow-red-900/20"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generando...
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                Descargar (.xlsx)
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
