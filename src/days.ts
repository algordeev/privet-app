// A day that exists on the calendar, written YYYY-MM-DD (so 2026-02-30 is rejected).
export function isCalendarDay(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [year,month,day]=value.split('-').map(Number);
 const date=new Date(0);
 date.setUTCFullYear(year,month-1,day);
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}

// Today's date on this device's calendar, as YYYY-MM-DD.
export function localDay(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
// The day `offset` days away from `day` (negative goes back). Computed at UTC noon, so it never drifts.
export function shiftDay(day:string,offset:number){const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
