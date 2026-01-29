// supabase/functions/_shared/ics-generator.ts
// Generates .ics calendar file content

export interface ICSEvent {
  summary: string
  description: string
  location: string
  startDate: string  // YYYY-MM-DD
  startTime: string  // HH:MM or HH:MM:SS (both supported now)
  durationMinutes: number
  organizerEmail: string
  organizerName: string
  attendeeEmail: string
  attendeeName: string
  url?: string
}

export function generateICS(event: ICSEvent): string {
  // Parse date and time
  // Handle both HH:MM and HH:MM:SS formats by NOT adding :00
  const startDateTime = new Date(`${event.startDate}T${event.startTime}`)
  const endDateTime = new Date(startDateTime.getTime() + event.durationMinutes * 60000)

  // Format dates for ICS (YYYYMMDDTHHMMSSZ)
  const formatICSDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  const dtStart = formatICSDate(startDateTime)
  const dtEnd = formatICSDate(endDateTime)
  const dtStamp = formatICSDate(new Date())

  // Generate unique UID
  const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@njordships.com`

  // Escape special characters in text fields
  const escapeText = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
  }

  // Build ICS content
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NJORD Ships//Maritime Recruitment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `LOCATION:${escapeText(event.location)}`,
    event.url ? `URL:${event.url}` : '',
    `ORGANIZER;CN=${escapeText(event.organizerName)}:mailto:${event.organizerEmail}`,
    `ATTENDEE;CN=${escapeText(event.attendeeName)};RSVP=TRUE:mailto:${event.attendeeEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    // Add alarm (reminder) 24 hours before
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${escapeText(event.summary)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(line => line !== '').join('\r\n')

  return icsContent
}

// Example usage:
// const ics = generateICS({
//   summary: 'Interview for Chief Officer Position',
//   description: 'Maritime interview with NJORD Ships recruitment team',
//   location: 'Zoom Meeting',
//   startDate: '2025-12-25',
//   startTime: '14:00',     // Works with HH:MM
//   // OR
//   startTime: '14:00:00',  // Also works with HH:MM:SS
//   durationMinutes: 60,
//   organizerEmail: 'recruitment@njordships.com',
//   organizerName: 'NJORD Ships Recruitment',
//   attendeeEmail: 'candidate@example.com',
//   attendeeName: 'John Doe',
//   url: 'https://zoom.us/j/123456789'
// })