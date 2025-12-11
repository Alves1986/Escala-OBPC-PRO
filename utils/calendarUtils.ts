
export const createGoogleCalendarLink = (event: { title: string; iso: string }, description: string = "") => {
  // O formato esperado pelo Google é YYYYMMDDTHHmmss
  // O sistema usa YYYY-MM-DDTHH:mm no ISO local
  
  const [datePart, timePart] = event.iso.split('T');
  const cleanDate = datePart.replace(/-/g, '');
  const cleanTime = timePart.replace(/:/g, '') + '00';
  
  const startDateTime = `${cleanDate}T${cleanTime}`;
  
  // Calcula fim (assume 2 horas de duração padrão para cultos)
  const eventDate = new Date(event.iso);
  eventDate.setHours(eventDate.getHours() + 2);
  
  const endYear = eventDate.getFullYear();
  const endMonth = String(eventDate.getMonth() + 1).padStart(2, '0');
  const endDay = String(eventDate.getDate()).padStart(2, '0');
  const endHour = String(eventDate.getHours()).padStart(2, '0');
  const endMin = String(eventDate.getMinutes()).padStart(2, '0');
  
  const endDateTime = `${endYear}${endMonth}${endDay}T${endHour}${endMin}00`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${startDateTime}/${endDateTime}`,
    details: description,
    // sprop: 'website:https://escalaobpcpro.vercel.app', // Opcional
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
