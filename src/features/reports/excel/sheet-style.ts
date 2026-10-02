import type { Worksheet } from "exceljs";
export function styleReportSheet(sheet: Worksheet, widths: number[], visibleColumns = widths.length) {
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];
  sheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1", horizontalCentered: true, margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: visibleColumns } };
  sheet.headerFooter = { oddFooter: "InternFlow &C&P / &N" };
  sheet.eachRow((row, index) => {
    let lines = 1;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.font = { name: "Calibri", size: 11, color: { argb: index === 1 ? "FFFFFFFF" : "FF182B49" }, bold: index === 1 };
      cell.alignment = { vertical: index === 1 ? "middle" : "top", wrapText: true, horizontal: index === 1 || column === 1 ? "center" : "left" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index === 1 ? "FF1674EA" : index % 2 === 0 ? "FFF1F6FC" : "FFFFFFFF" } };
      cell.border = { bottom: { style: "hair", color: { argb: "FFDCE6F2" } } };
      if (cell.type === 5) cell.font = { ...cell.font, color: { argb: "FF1269D4" }, underline: true };
      const value = cell.value && typeof cell.value === "object" && "text" in cell.value ? cell.value.text : cell.value;
      if (column <= visibleColumns) for (const part of String(value ?? "").split("\n")) lines = Math.max(lines, Math.ceil(part.length / Math.max(8, (widths[column - 1] ?? 24) - 2)) + String(value ?? "").split("\n").length - 1);
    });
    row.height = index === 1 ? 30 : Math.min(409, Math.max(30, lines * 15 + 12));
  });
}
