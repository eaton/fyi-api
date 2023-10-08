import { parse, format } from 'date-fns';

export function changeDate(date: Date, output: string): string;
export function changeDate(date: string, input: string, output?: string): string;
export function changeDate(date: string | Date, inputOrOutput: string, output = 'yyyy-MM-dd'): string {
  let parsed = new Date();
  let outputFormat = 'yyyy-MM-dd';
  
  if (typeof(date) === 'string') {
    parsed = parse(date, inputOrOutput, new Date());
    outputFormat = output;
  } else {
    outputFormat = inputOrOutput;
  }

  return format(parsed, outputFormat);
}