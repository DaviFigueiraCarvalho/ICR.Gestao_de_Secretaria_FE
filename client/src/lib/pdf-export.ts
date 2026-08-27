import { jsPDF } from 'jspdf';

export interface PdfTableColumn {
  header: string;
  widthFraction: number;
  align?: 'left' | 'center';
}

interface DownloadTablePdfOptions {
  fileName: string;
  title: string;
  subtitle?: string;
  columns: PdfTableColumn[];
  rows: string[][];
}

const normalizePdfText = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim();

export function downloadTablePdf({ fileName, title, subtitle, columns, rows }: DownloadTablePdfOptions): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const leftMargin = 10;
  const rightMargin = 10;
  const topMargin = 10;
  const bottomMargin = 12;
  const tableWidth = pageWidth - leftMargin - rightMargin;
  const columnWidths = columns.map((column) => tableWidth * column.widthFraction);

  const headerFill = [1, 113, 88] as const;
  const altFill = [231, 241, 223] as const;
  const borderColor = [0, 0, 0] as const;
  const textColor = [0, 0, 0] as const;
  const cellPaddingX = 2;
  const cellPaddingY = 1.5;
  const fontSizeBody = 9.5;
  const fontSizeHeader = 10;
  const lineHeight = 4.2;
  const minRowHeight = 8.5;
  const headerHeight = 9;

  let cursorY = topMargin;

  const setColors = (
    fill: readonly [number, number, number],
    border: readonly [number, number, number],
    text: readonly [number, number, number],
  ) => {
    pdf.setFillColor(fill[0], fill[1], fill[2]);
    pdf.setDrawColor(border[0], border[1], border[2]);
    pdf.setTextColor(text[0], text[1], text[2]);
  };

  const drawTitle = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    pdf.text(title, pageWidth / 2, cursorY + 5, { align: 'center', baseline: 'middle' });
    cursorY += 8;

    if (subtitle) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(subtitle, pageWidth / 2, cursorY + 4, { align: 'center', baseline: 'middle' });
      cursorY += 7;
    }

    cursorY += 2;
  };

  const drawHeader = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(fontSizeHeader);
    let x = leftMargin;

    columns.forEach((column, index) => {
      const width = columnWidths[index];
      setColors(headerFill, borderColor, [255, 255, 255]);
      pdf.rect(x, cursorY, width, headerHeight, 'FD');
      pdf.text(column.header, x + width / 2, cursorY + headerHeight / 2, { align: 'center', baseline: 'middle' });
      x += width;
    });

    cursorY += headerHeight;
  };

  const createNewPage = () => {
    pdf.addPage();
    cursorY = topMargin;
    drawHeader();
  };

  drawTitle();
  drawHeader();

  rows.forEach((row, rowIndex) => {
    const cellsLines = row.map((value, columnIndex) => {
      const width = columnWidths[columnIndex] - cellPaddingX * 2;
      const text = normalizePdfText(value || '-');
      return (pdf.splitTextToSize(text, width) as string[]).map((line) => normalizePdfText(line));
    });

    const maxLines = Math.max(1, ...cellsLines.map((lines) => lines.length));
    const rowHeight = Math.max(minRowHeight, maxLines * lineHeight + cellPaddingY * 2);

    if (cursorY + rowHeight > pageHeight - bottomMargin) {
      createNewPage();
    }

    let cellX = leftMargin;
    const rowFill = rowIndex % 2 === 0 ? ([255, 255, 255] as const) : altFill;

    columns.forEach((column, columnIndex) => {
      const width = columnWidths[columnIndex];
      const lines = cellsLines[columnIndex];
      const align = column.align ?? 'left';

      setColors(rowFill, borderColor, textColor);
      pdf.rect(cellX, cursorY, width, rowHeight, 'FD');

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(fontSizeBody);

      const textBlockHeight = lines.length * lineHeight;
      const startY = cursorY + ((rowHeight - textBlockHeight) / 2) + (lineHeight * 0.75);
      const textX = align === 'left' ? cellX + cellPaddingX : cellX + width / 2;

      lines.forEach((line, lineIndex) => {
        pdf.text(line, textX, startY + lineIndex * lineHeight, { align, baseline: 'middle' });
      });

      cellX += width;
    });

    cursorY += rowHeight;
  });

  pdf.save(fileName);
}
