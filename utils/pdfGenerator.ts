
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ScheduleMap, Role } from "../types";
import { getMonthName } from "./dateUtils";

const BRAND_COLOR = [13, 148, 136]; // Teal-600 (#0d9488)
const HEADER_COLOR = [240, 253, 250]; // Teal-50
const TEXT_COLOR = [24, 24, 27]; // Zinc-900

export const generateFullSchedulePDF = (
  ministryName: string,
  monthIso: string,
  events: { iso: string; title: string; dateDisplay: string }[],
  roles: Role[],
  schedule: ScheduleMap
) => {
  const doc = new jsPDF({ orientation: "landscape" });
  const monthName = getMonthName(monthIso);

  // Header
  doc.setFillColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.rect(0, 0, 297, 24, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(ministryName.toUpperCase(), 14, 16);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Escala de ${monthName}`, 280, 16, { align: "right" });

  // Columns
  const columns = [
    { header: "Data", dataKey: "date" },
    { header: "Horário", dataKey: "time" },
    { header: "Evento", dataKey: "event" },
    ...roles.map(r => ({ header: r, dataKey: r }))
  ];

  // Rows
  const body = events.map(evt => {
    const time = evt.iso.split('T')[1];
    const row: any = {
      date: evt.dateDisplay,
      time: time,
      event: evt.title
    };

    roles.forEach(role => {
      // Logic to handle potential dynamic roles like Vocal 1, Vocal 2 if strict mapping is used, 
      // but assuming standard roles array passed matches schedule keys for now.
      // If roles array contains "Vocal", but schedule has "Vocal_1", "Vocal_2", this needs specific handling.
      // For general cases:
      const key = `${evt.iso}_${role}`;
      
      // Try exact match first
      let value = schedule[key];
      
      // Special handling for "Vocal" aggregation if needed, or if roles passed are specific
      // Assuming 'roles' passed to this function are the columns to display.
      
      row[role] = value || "-";
    });

    return row;
  });

  // @ts-ignore
  autoTable(doc, {
    columns: columns,
    body: body,
    startY: 32,
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: TEXT_COLOR,
      lineColor: [228, 228, 231], // Zinc-200
      lineWidth: 0.1,
    },
    columnStyles: {
      date: { fontStyle: 'bold', cellWidth: 20, halign: 'center' },
      time: { cellWidth: 15, halign: 'center' },
      event: { fontStyle: 'bold', cellWidth: 40 },
    },
    alternateRowStyles: {
      fillColor: HEADER_COLOR
    },
    didParseCell: function(data: any) {
       // Highlight empty cells or specific status if needed
       if (data.section === 'body' && data.cell.raw === '-') {
           data.cell.styles.textColor = [161, 161, 170]; // Zinc-400
       }
    }
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} - Gestão Escala OBPC`, 14, doc.internal.pageSize.height - 10);
  }

  doc.save(`escala_${ministryName.toLowerCase().replace(/\s/g, '_')}_${monthIso}.pdf`);
};

export const generateIndividualPDF = (
  ministryName: string,
  monthIso: string,
  memberName: string,
  events: { iso: string; title: string; dateDisplay: string }[],
  schedule: ScheduleMap
) => {
  const doc = new jsPDF();
  const monthName = getMonthName(monthIso);

  // Header
  doc.setFillColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.rect(0, 0, 210, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`Escala Individual - ${monthName}`, 105, 20, { align: "center" });
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(memberName, 105, 30, { align: "center" });

  const myEvents = [];

  events.forEach(evt => {
      Object.entries(schedule).forEach(([key, assignedName]) => {
          if (key.startsWith(evt.iso) && assignedName === memberName) {
              const role = key.split('_').slice(1).join(' '); // Handle Vocal_1 -> Vocal 1
              myEvents.push({
                  date: evt.dateDisplay,
                  weekday: new Date(evt.iso).toLocaleDateString('pt-BR', { weekday: 'long' }),
                  time: evt.iso.split('T')[1],
                  event: evt.title,
                  role: role
              });
          }
      });
  });

  if (myEvents.length === 0) {
      doc.setTextColor(100);
      doc.setFontSize(12);
      doc.text("Nenhuma escala encontrada para este período.", 105, 60, { align: "center" });
      doc.save(`escala_${memberName}_${monthIso}.pdf`);
      return;
  }

  // @ts-ignore
  autoTable(doc, {
      body: myEvents,
      columns: [
          { header: 'Dia', dataKey: 'date' },
          { header: 'Semana', dataKey: 'weekday' },
          { header: 'Horário', dataKey: 'time' },
          { header: 'Evento', dataKey: 'event' },
          { header: 'Função', dataKey: 'role' },
      ],
      startY: 50,
      theme: 'striped',
      headStyles: {
          fillColor: BRAND_COLOR,
          textColor: 255,
          fontStyle: 'bold'
      },
      styles: {
          cellPadding: 4,
          fontSize: 11
      },
      columnStyles: {
          date: { fontStyle: 'bold', halign: 'center' },
          time: { halign: 'center' },
          role: { fontStyle: 'bold', textColor: [217, 119, 6] } // Amber-600
      }
  });

  // Footer Message
  const finalY = (doc as any).lastAutoTable.finalY || 150;
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`"Tudo o que fizerem, façam de todo o coração, como para o Senhor." (Col 3:23)`, 105, finalY + 20, { align: "center" });

  doc.save(`escala_${memberName.replace(/\s/g, '_')}_${monthIso}.pdf`);
};
