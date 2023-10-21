import { add, sub } from 'date-fns';

/**
 * Takes a two-element duration string (like '3 months 5 days' or '1 year 3 weeks')
 * and subtracts it from or adds it to the given date. If no date is provided,
 * the offset is subtracted from or added to the current date. 
 */
export function dateFromOffset(timeAgo: string, date?: Date, past = true) {
  date ??= new Date(Date.now());
  const offset: Record<string, number> = {};
  const units = (timeAgo.match(/(\d+\s[\w]+)\s(\d+\s[\w]+)/) ?? []).slice(1)
    .map(u => u.split(/\s+/))
    .map(u => { return { value: u[0], unit: u[1] } });
  
  for (const d of units) {
    const unit = d.unit.toLocaleLowerCase().slice(0,3);
    switch (unit) {
      case 'yea':
        offset.years = Number.parseInt(d.value);
        break;
      case 'mon':
        offset.months = Number.parseInt(d.value);
        break;
      case 'wee':
        offset.weeks = Number.parseInt(d.value);
        break;
      case 'day':
        offset.days = Number.parseInt(d.value);
        break;
      case 'hou':
        offset.hours = Number.parseInt(d.value);
        break;
      case 'min':
        offset.minutes = Number.parseInt(d.value);
        break;
      case 'sec':
        offset.seconds = Number.parseInt(d.value);
        break;
    }
  }

  const output = past ?
    sub(date, offset).toISOString() :
    add(date, offset).toISOString();

  return output;
}
