import { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import ICRLayout from '../components/ICRLayout';
import { useICRApi, Minister } from '../hooks/useICRApi';
import { getMinisterCoverageBadgeClass, getMinisterCoverageLabel, resolveMinisterCoverageStatus, summarizeMinisterCoverage } from '../lib/minister-coverage';
import { useSharedMinisterData } from '../hooks/useSharedMinisterData';

export default function MinistersInsurance() {
  const { fetchApi } = useICRApi();
  const { data: sharedData, isLoading: sharedLoading, error: sharedError } = useSharedMinisterData();
  const [data, setData] = useState<Minister[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [generatedPdfName, setGeneratedPdfName] = useState<string>('seguro-ministros.pdf');
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setData(sharedData);
    setIsLoading(sharedLoading);
    setError(sharedError);
  }, [sharedData, sharedLoading, sharedError]);

  const summary = useMemo(() => summarizeMinisterCoverage(data), [data]);

  const sortedData = useMemo(
    () => [...data].sort((a, b) => (a.memberName || '').localeCompare((b.memberName || ''), 'pt-BR', { sensitivity: 'base' })),
    [data],
  );

  const formatLongDate = (value: Date): string => {
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(value);

    return `Vitória, ${formatted}`;
  };
const getPhoneDisplay = (
  phone?: Minister['memberPhone']
) => {
  if (!phone) return '-';

  return (
    phone.e164Format ||
    phone.displayFormat ||
    phone.internationalFormat ||
    phone.number ||
    '-'
  );
};
  const normalizePdfText = (value: unknown): string => {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const drawMultilineCenteredText = (
    pdf: jsPDF,
    lines: string[],
    centerX: number,
    topY: number,
    lineHeight: number,
  ) => {
    const textBlockHeight = lines.length * lineHeight;
    const startY = topY + (lineHeight * 0.75);

    lines.forEach((line, index) => {
      pdf.text(line, centerX, startY + (index * lineHeight), { align: 'center', baseline: 'middle' });
    });

    return topY + textBlockHeight;
  };

  const buildPdfDocument = () => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const leftMargin = 7;
    const rightMargin = 7;
    const topMargin = 7;
    const bottomMargin = 10;
    const tableWidth = pageWidth - leftMargin - rightMargin;
    const columnWidths = [
      tableWidth * 0.15,
      tableWidth * 0.14,
      tableWidth * 0.16,
      tableWidth * 0.41,
      tableWidth * 0.14,
    ];
    const columnHeaders = ['Nome', 'CPF', 'Telefone', 'E-mail', 'Data de\nNascimento'];
    const headerFill = [47, 125, 32] as const;
    const altFill = [231, 241, 223] as const;
    const borderColor = [0, 0, 0] as const;
    const textColor = [0, 0, 0] as const;
    const cellPaddingX = 1.6;
    const cellPaddingY = 1.2;
    const fontSizeBody = 7.4;
    const fontSizeHeader = 8;
    const lineHeight = 3.7;
    const minRowHeight = 8.5;
    const headerHeight = 10;
    const titleText = 'RELAÇÃO DE SEGURO PARA PASTORES E PRESBÍTERO';
    const titleTopY = 9;
    const titleHeight = 8;
    const firstPageTableTop = 21;
    const repeatedPageTableTop = topMargin;
    const footerSpace = 30;
    let cursorY = firstPageTableTop + headerHeight;

    const setColors = (fill: readonly [number, number, number], border: readonly [number, number, number], text: readonly [number, number, number]) => {
      pdf.setFillColor(fill[0], fill[1], fill[2]);
      pdf.setDrawColor(border[0], border[1], border[2]);
      pdf.setTextColor(text[0], text[1], text[2]);
    };

    const drawDocumentTitle = () => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(0, 0, 0);
      pdf.text(titleText, pageWidth / 2, titleTopY + (titleHeight / 2), { align: 'center', baseline: 'middle' });
    };

    const drawHeader = (y: number) => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(fontSizeHeader);
      let x = leftMargin;

      columnHeaders.forEach((header, index) => {
        const width = columnWidths[index];
        const lines = header.split('\n');
        setColors(headerFill, borderColor, [255, 255, 255]);
        pdf.rect(x, y, width, headerHeight, 'FD');

        const textStartY = y + ((headerHeight - (lines.length * lineHeight)) / 2);
        drawMultilineCenteredText(pdf, lines, x + (width / 2), textStartY, lineHeight);
        x += width;
      });
    };

    const drawFooter = (y: number) => {
      const dateText = formatLongDate(new Date());
      const signatureLineWidth = 72;
      const signatureCenterX = pageWidth / 2;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.text(dateText, signatureCenterX, y + 8, { align: 'center' });

      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.3);
      pdf.line(signatureCenterX - signatureLineWidth / 2, y + 22, signatureCenterX + signatureLineWidth / 2, y + 22);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.text('Presidente da Federação ICR Avivalista do Brasil', signatureCenterX, y + 28, { align: 'center' });
    };

    const createNewPage = () => {
      if (pdf.getNumberOfPages() > 0) {
        pdf.addPage();
      }
      cursorY = repeatedPageTableTop;
      drawHeader(cursorY);
      cursorY += headerHeight;
    };

    const prepareFirstPage = () => {
      drawDocumentTitle();
      drawHeader(firstPageTableTop);
      cursorY = firstPageTableTop + headerHeight;
    };

    const drawCellText = (
      lines: string[],
      x: number,
      y: number,
      width: number,
      height: number,
      options: { align: 'left' | 'center' },
    ) => {
      const textBlockHeight = lines.length * lineHeight;
      const startY = y + ((height - textBlockHeight) / 2) + (lineHeight * 0.75);
      const textX = options.align === 'left' ? x + cellPaddingX : x + (width / 2);

      lines.forEach((line, index) => {
        pdf.text(line, textX, startY + (index * lineHeight), {
          align: options.align,
          baseline: 'middle',
        });
      });
    };

    const insuredMinisters = sortedData.filter((minister) => {
      const status = normalizePdfText(
        minister.insuranceStatus ?? minister.status ?? minister.coverageStatus ?? '',
      ).toUpperCase();

      if (status === 'NÃO SEGURADO' || status === 'NAO SEGURADO') {
        return false;
      }

      return resolveMinisterCoverageStatus(minister) === 'covered';
    });

    prepareFirstPage();

    insuredMinisters.forEach((minister, index) => {
      const name = normalizePdfText(minister.memberName || '-');
      const cpf = normalizePdfText(minister.cpf || '-');
      const phone = normalizePdfText(getPhoneDisplay(minister.memberPhone) || '-');
      const email = normalizePdfText(minister.email || '-');
      const birthDate = normalizePdfText(minister.memberBirthday ? new Date(minister.memberBirthday).toLocaleDateString('pt-BR') : '-');

      const nameColumnWidth = columnWidths[0];
      const cpfColumnWidth = columnWidths[1];
      const phoneColumnWidth = columnWidths[2];
      const emailColumnWidth = columnWidths[3];
      const birthColumnWidth = columnWidths[4];

      const nameTextWidth = nameColumnWidth - cellPaddingX * 2;
      const cpfTextWidth = cpfColumnWidth - cellPaddingX * 2;
      const phoneTextWidth = phoneColumnWidth - cellPaddingX * 2;
      const emailTextWidth = emailColumnWidth - cellPaddingX * 2;
      const birthTextWidth = birthColumnWidth - cellPaddingX * 2;

      const nameLines = (pdf.splitTextToSize(name, nameTextWidth) as string[]).map((line) => normalizePdfText(line));
      const cpfLines = (pdf.splitTextToSize(cpf, cpfTextWidth) as string[]).map((line) => normalizePdfText(line));
      const phoneLines = (pdf.splitTextToSize(phone, phoneTextWidth) as string[]).map((line) => normalizePdfText(line));
      const emailLines = (pdf.splitTextToSize(email, emailTextWidth) as string[]).map((line) => normalizePdfText(line));
      const birthLines = (pdf.splitTextToSize(birthDate, birthTextWidth) as string[]).map((line) => normalizePdfText(line));

      const maxLines = Math.max(
        nameLines.length,
        cpfLines.length,
        phoneLines.length,
        emailLines.length,
        birthLines.length,
      );

      const rowHeight = Math.max(minRowHeight, maxLines * lineHeight + cellPaddingY * 2);

      if (cursorY + rowHeight > pageHeight - bottomMargin - footerSpace) {
        createNewPage();
      }

      let cellX = leftMargin;
      const rowFill = index % 2 === 0 ? [255, 255, 255] as const : altFill;
      const rowCells = [
        { lines: nameLines, width: nameColumnWidth, align: 'left' as const },
        { lines: cpfLines, width: cpfColumnWidth, align: 'center' as const },
        { lines: phoneLines, width: phoneColumnWidth, align: 'center' as const },
        { lines: emailLines, width: emailColumnWidth, align: 'center' as const },
        { lines: birthLines, width: birthColumnWidth, align: 'center' as const },
      ];

      rowCells.forEach((cell) => {
        const width = cell.width;
        setColors(rowFill, borderColor, textColor);
        pdf.rect(cellX, cursorY, width, rowHeight, 'FD');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(fontSizeBody);
        drawCellText(cell.lines.length > 0 ? cell.lines : ['-'], cellX, cursorY, width, rowHeight, { align: cell.align });

        cellX += width;
      });

      cursorY += rowHeight;
    });

    drawFooter(cursorY + 2);

    return pdf;
  };

  const openGeneratedPdf = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const downloadGeneratedPdf = (url: string, fileName: string) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  };

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      const pdf = buildPdfDocument();
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setGeneratedPdfUrl(url);
      setGeneratedPdfName(`seguro-ministros-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGenerateExcel = async () => {
    setIsGeneratingExcel(true);
    try {
      const insuredMinisters = sortedData.filter((minister) => {
        const status = normalizePdfText(
          minister.insuranceStatus ?? minister.status ?? minister.coverageStatus ?? '',
        ).toUpperCase();

        if (status === 'NÃO SEGURADO' || status === 'NAO SEGURADO') {
          return false;
        }

        return resolveMinisterCoverageStatus(minister) === 'covered';
      });

      const excelData = insuredMinisters.map((minister) => ({
        Nome: minister.memberName || '-',
        CPF: minister.cpf || '-',
        Telefone: getPhoneDisplay(minister.memberPhone) || '-',
        'E-mail': minister.email || '-',
        Nascimento: minister.memberBirthday ? new Date(minister.memberBirthday).toLocaleDateString('pt-BR') : '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Seguro Ministros');

      const excelBlob = new Blob(
        [XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      );
      const url = URL.createObjectURL(excelBlob);
      const fileName = `seguro-ministros-${new Date().toISOString().slice(0, 10)}.xlsx`;

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();

      URL.revokeObjectURL(url);
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  return (
    <ICRLayout title="Seguro de Ministros">
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-white/50 text-xs uppercase tracking-[0.2em] font-['Nunito']">Total</p>
            <p className="text-white text-3xl font-['Nunito'] font-semibold">{summary.total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-emerald-200 text-xs uppercase tracking-[0.2em] font-['Nunito']">Segurados / elegíveis</p>
            <p className="text-white text-3xl font-['Nunito'] font-semibold">{summary.covered}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
            <p className="text-rose-200 text-xs uppercase tracking-[0.2em] font-['Nunito']">Não segurados</p>
            <p className="text-white text-3xl font-['Nunito'] font-semibold">{summary.uncovered}</p>
          </div>
        </div>

        {isLoading && (
          <div className="rounded-3xl border border-white/10 bg-[#242424] p-8 text-center text-white/60 font-['Nunito']">
            Carregando seguro de ministros...
          </div>
        )}

        {error && !isLoading && (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-200 font-['Nunito']">
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <section className="rounded-3xl border border-white/10 bg-[#202020] p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <div>
                <h2 className="text-white text-2xl font-['Nunito'] font-semibold mb-1">Lista de ministros</h2>
                <p className="text-white/45 font-['Nunito']">Ordenado alfabeticamente. Os não segurados aparecem em vermelho.</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-white/55 text-sm font-['Nunito']">{sortedData.length} registros</div>
                <button
                  type="button"
                  onClick={handleGeneratePdf}
                  disabled={isGeneratingPdf || sortedData.length === 0}
                  className="rounded-xl bg-[#017158] px-4 py-2 text-sm font-['Nunito'] text-white hover:bg-[#01906f] transition-colors disabled:opacity-50"
                >
                  {isGeneratingPdf ? 'Gerando...' : 'Gerar Relatório'}
                </button>
                <button
                  type="button"
                  onClick={handleGenerateExcel}
                  disabled={isGeneratingExcel || sortedData.length === 0}
                  className="rounded-xl bg-[#017158] px-4 py-2 text-sm font-['Nunito'] text-white hover:bg-[#01906f] transition-colors disabled:opacity-50"
                >
                  {isGeneratingExcel ? 'Gerando...' : 'Baixar Excel'}
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-0 bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.2em] text-white/45 font-['Nunito']">
                <div>Nome</div>
                <div>CPF</div>
                <div>Telefone</div>
                <div>E-mail</div>
                <div>Nascimento</div>
              </div>

              <div className="divide-y divide-white/10">
                {sortedData.length === 0 ? (
                  <div className="px-4 py-6 text-white/60 font-['Nunito']">Nenhum ministro encontrado.</div>
                ) : sortedData.map((minister) => {
                  const isCovered = resolveMinisterCoverageStatus(minister) === 'covered';

                  return (
                    <div
                      key={minister.id}
                      className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-0 px-4 py-4 text-sm font-['Nunito'] ${isCovered ? 'bg-transparent text-white' : 'bg-rose-500/10 text-rose-100'}`}
                    >
                      <div className="pr-3">
                        <p className="font-semibold">{minister.memberName || '-'}</p>
                        <p className="text-xs text-white/45 mt-1">
                          {minister.federationMemberName || '-'} • {minister.churchMemberName || '-'}
                        </p>
                      </div>
                      <div className="pr-3">{minister.cpf || '-'}</div>
                      <div className="pr-3">  {getPhoneDisplay(minister.memberPhone || minister.member?.cellPhone)}</div>                      
                      <div className="pr-3 break-words">{minister.email || '-'}</div>
                      <div className="pr-3">{minister.memberBirthday ? new Date(minister.memberBirthday).toLocaleDateString('pt-BR') : '-'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>

      {generatedPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#202020] p-6 shadow-2xl">
            <p className="text-white/50 text-xs uppercase tracking-[0.2em] font-['Nunito'] mb-2">Relatório gerado</p>
            <h3 className="text-white text-2xl font-['Nunito'] font-semibold mb-3">Escolha uma ação</h3>
            <p className="text-white/60 font-['Nunito'] mb-5">
              O arquivo foi criado sem área e igreja. Você pode abrir em outra guia ou baixar agora.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => openGeneratedPdf(generatedPdfUrl)}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-['Nunito'] text-white hover:border-white/30 transition-colors"
              >
                Visualizar em outra guia
              </button>
              <button
                type="button"
                onClick={() => downloadGeneratedPdf(generatedPdfUrl, generatedPdfName)}
                className="rounded-xl bg-[#017158] px-4 py-2 text-sm font-['Nunito'] text-white hover:bg-[#01906f] transition-colors"
              >
                Baixar PDF
              </button>
              <button
                type="button"
                onClick={handleGenerateExcel}
                disabled={isGeneratingExcel}
                className="rounded-xl bg-[#017158] px-4 py-2 text-sm font-['Nunito'] text-white hover:bg-[#01906f] transition-colors disabled:opacity-50"
              >
                {isGeneratingExcel ? 'Gerando...' : 'Baixar Excel'}
              </button>
              <button
                type="button"
                onClick={() => setGeneratedPdfUrl(null)}
                className="rounded-xl border border-white/15 bg-transparent px-4 py-2 text-sm font-['Nunito'] text-white/70 hover:text-white transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </ICRLayout>
  );
}