
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ScheduleMap, Role } from "../types";
import { getMonthName } from "./dateUtils";

// --- Design Constants ---
const COLORS = {
  PRIMARY: [13, 148, 136],    // Teal-600
  SECONDARY: [15, 118, 110],  // Teal-700
  ACCENT: [204, 251, 241],    // Teal-50
  TEXT_DARK: [39, 39, 42],    // Zinc-800
  TEXT_LIGHT: [113, 113, 122],// Zinc-500
  TABLE_LINE: [228, 228, 231],// Zinc-200
  WHITE: [255, 255, 255]
};

const LOGO_URL = "https://i.ibb.co/nsFR8zNG/icon1.png"; // Usando o ícone do app

// Helper para desenhar cabeçalho padrão
const drawHeader = (doc: jsPDF, title: string, subtitle: string, orientation: 'p' | 'l' = 'l') => {
  const pageWidth = doc.internal.pageSize.width;
  
  // Barra lateral decorativa
  doc.setFillColor(COLORS.PRIMARY[0], COLORS.PRIMARY[1], COLORS.PRIMARY[2]);
  doc.rect(0, 0, 4, 30, "F");

  // Título Principal
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(COLORS.TEXT_DARK[0], COLORS.TEXT_DARK[1], COLORS.TEXT_DARK[2]);
  doc.text(title.toUpperCase(), 14, 15);

  // Subtítulo (Mês/Ano)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(COLORS.TEXT_LIGHT[0], COLORS.TEXT_LIGHT[1], COLORS.TEXT_LIGHT[2]);
  doc.text(subtitle, 14, 22);

  // Data de Geração no canto direito
  doc.setFontSize(8);
  const dateStr = `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`;
  doc.text(dateStr, pageWidth - 14, 15, { align: "right" });
  
  // Linha separadora suave
  doc.setDrawColor(COLORS.TABLE_LINE[0], COLORS.TABLE_LINE[1], COLORS.TABLE_LINE[2]);
  doc.line(14, 28, pageWidth - 14, 28);
};

// Helper para rodapé
const drawFooter = (doc: jsPDF) => {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      
      // Esquerda
      doc.text("Gestão Escala OBPC - Sistema Integrado", 14, pageHeight - 10);
      
      // Direita (Paginação)
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: "right" });
  }
};

export const generateFullSchedulePDF = (
  ministryName: string,
  monthIso: string,
  events: { id?: string; iso: string; title: string; dateDisplay: string }[],
  roles: Role[],
  schedule: ScheduleMap
) => {
  // Landscape para caber todas as colunas
  const doc = new jsPDF({ orientation: "landscape" });
  const monthName = getMonthName(monthIso);

  drawHeader(doc, ministryName, `Escala Oficial - ${monthName}`);

  // Preparar Colunas
  const columns = [
    { header: "DATA", dataKey: "date" },
    { header: "HORA", dataKey: "time" },
    { header: "EVENTO", dataKey: "event" },
    ...roles.map(r => ({ header: r.toUpperCase(), dataKey: r }))
  ];

  console.log("PDF_EXPORT_RAW", { events, roles, schedule });

  // Preparar Dados
  const body = events.map(evt => {
    const time = evt.iso.split('T')[1].substring(0, 5); // HH:mm
    
    // Detectar dia da semana
    const dateObj = new Date(evt.iso);
    const weekDay = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase();
    
    const row: any = {
      date: `${evt.dateDisplay} (${weekDay.replace('.', '')})`,
      time: time,
      event: evt.title
    };

    const eventKeyBase = evt.id || evt.iso;

    roles.forEach(role => {
      const key = `${eventKeyBase}_${role}`;
      const value = schedule[key];
      row[role] = value || "";
    });

    return row;
  });

  // Gerar Tabela
  // @ts-ignore
  autoTable(doc, {
    columns: columns,
    body: body,
    startY: 35,
    theme: 'grid', // Mantemos grid mas customizamos as bordas
    headStyles: {
      fillColor: COLORS.WHITE as [number, number, number],
      textColor: COLORS.SECONDARY as [number, number, number],
      fontStyle: 'bold',
      fontSize: 8,
      lineWidth: 0,
      valign: 'middle',
      halign: 'left'
    },
    bodyStyles: {
      fillColor: COLORS.WHITE as [number, number, number],
      textColor: COLORS.TEXT_DARK as [number, number, number],
      fontSize: 9,
      cellPadding: 4,
      lineColor: COLORS.TABLE_LINE as [number, number, number],
      lineWidth: 0.1,
    },
    columnStyles: {
      date: { fontStyle: 'bold', cellWidth: 28, textColor: COLORS.SECONDARY as [number, number, number] },
      time: { cellWidth: 20, halign: 'center' },
      event: { fontStyle: 'bold', cellWidth: 50 },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250] as [number, number, number]
    },
    didParseCell: function(data: any) {
       // Remove bordas verticais para um look "SaaS Moderno"
       if (data.section === 'head') {
           data.cell.styles.lineWidth = 0; 
           // Adiciona uma linha grossa apenas embaixo do header
       }
       if (data.section === 'body' && !data.cell.raw) {
           data.cell.text = ["-"];
           data.cell.styles.textColor = [200, 200, 200];
           data.cell.styles.halign = 'center';
       }
    },
    willDrawCell: function(data: any) {
        // Adiciona linha inferior mais forte no cabeçalho
        if (data.row.index === -1 && data.section === 'head') {
            doc.setDrawColor(COLORS.PRIMARY[0], COLORS.PRIMARY[1], COLORS.PRIMARY[2]);
            doc.setLineWidth(0.5);
            doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
    }
  });

  drawFooter(doc);
  doc.save(`Escala_${ministryName.trim()}_${monthIso}.pdf`);
};

export const generateIndividualPDF = (
  ministryName: string,
  monthIso: string,
  memberName: string,
  events: { id?: string; iso: string; title: string; dateDisplay: string }[],
  schedule: ScheduleMap
) => {
  // Portrait para individual
  const doc = new jsPDF();
  const monthName = getMonthName(monthIso);

  drawHeader(doc, ministryName, `Ficha Individual - ${monthName}`, 'p');

  // Info do Membro (Card style)
  doc.setFillColor(248, 250, 252); // Zinc-50
  doc.roundedRect(14, 35, 182, 25, 2, 2, "F");
  
  doc.setFontSize(10);
  doc.setTextColor(COLORS.TEXT_LIGHT[0], COLORS.TEXT_LIGHT[1], COLORS.TEXT_LIGHT[2]);
  doc.text("MEMBRO", 20, 42);
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.TEXT_DARK[0], COLORS.TEXT_DARK[1], COLORS.TEXT_DARK[2]);
  doc.text(memberName, 20, 50);

  console.log("PDF_EXPORT_RAW", { events, memberName, schedule });

  // Filtrar eventos do membro
  const myEvents: any[] = [];
  events.forEach(evt => {
      const eventKeyBase = evt.id || evt.iso;
      const keyPrefix = `${eventKeyBase}_`;

      Object.entries(schedule).forEach(([key, assignedName]) => {
          if (key.startsWith(keyPrefix) && assignedName === memberName) {
              const role = key.substring(keyPrefix.length).split('_').join(' ');
              myEvents.push({
                  date: evt.dateDisplay,
                  weekday: new Date(evt.iso).toLocaleDateString('pt-BR', { weekday: 'long' }),
                  time: evt.iso.split('T')[1].substring(0, 5),
                  event: evt.title,
                  role: role
              });
          }
      });
  });

  if (myEvents.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(150);
      doc.text("Nenhuma escala encontrada para este período.", 105, 80, { align: "center" });
      drawFooter(doc);
      doc.save(`Individual_${memberName}_${monthIso}.pdf`);
      return;
  }

  // @ts-ignore
  autoTable(doc, {
      body: myEvents,
      columns: [
          { header: 'DIA', dataKey: 'date' },
          { header: 'SEMANA', dataKey: 'weekday' },
          { header: 'HORÁRIO', dataKey: 'time' },
          { header: 'EVENTO', dataKey: 'event' },
          { header: 'FUNÇÃO', dataKey: 'role' },
      ],
      startY: 70,
      theme: 'plain', // Theme Plain para customizar total
      headStyles: {
          fillColor: COLORS.WHITE as [number, number, number],
          textColor: COLORS.SECONDARY as [number, number, number],
          fontStyle: 'bold',
          fontSize: 9
      },
      styles: {
          cellPadding: 5,
          fontSize: 10,
          textColor: COLORS.TEXT_DARK as [number, number, number],
          valign: 'middle'
      },
      columnStyles: {
          date: { fontStyle: 'bold', textColor: COLORS.PRIMARY as [number, number, number] },
          role: { fontStyle: 'bold', textColor: [217, 119, 6] as [number, number, number] }
      },
      willDrawCell: function(data: any) {
          // Linha divisória fina entre eventos
          if (data.section === 'body' && data.column.index === 0) {
               doc.setDrawColor(240, 240, 240);
               doc.line(14, data.cell.y, 196, data.cell.y);
          }
          // Linha de cabeçalho
          if (data.section === 'head' && data.column.index === 0) {
              doc.setDrawColor(COLORS.PRIMARY[0], COLORS.PRIMARY[1], COLORS.PRIMARY[2]);
              doc.setLineWidth(0.5);
              doc.line(14, data.cell.y + data.cell.height, 196, data.cell.y + data.cell.height);
          }
      }
  });

  // Mensagem Final
  const finalY = (doc as any).lastAutoTable.finalY || 150;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`"Tudo o que fizerem, façam de todo o coração, como para o Senhor."`, 105, finalY + 20, { align: "center" });
  doc.text(`(Colossenses 3:23)`, 105, finalY + 25, { align: "center" });

  drawFooter(doc);
  doc.save(`Individual_${memberName.replace(/\s/g, '_')}_${monthIso}.pdf`);
};
