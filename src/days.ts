// A day that exists on the calendar, written YYYY-MM-DD (so 2026-02-30 is rejected).
export function isCalendarDay(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [year,month,day]=value.split('-').map(Number);
 const date=new Date(0);
 date.setUTCFullYear(year,month-1,day);
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
