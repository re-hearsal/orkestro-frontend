import type { components } from "../../api/schema";

export type EventCalendarDTO = components["schemas"]["EventCalendarDTO"];
export type SectionDTO = components["schemas"]["SectionDTO"];

export interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: EventCalendarDTO & { sectionIds: number[] };
}
