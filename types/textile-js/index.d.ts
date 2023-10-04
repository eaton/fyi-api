export = textile;
declare function textile(txt: string, opt?: Record<string, unknown>): string;
declare namespace textile {
  namespace defaults {
    let breaks: boolean;
  }
  function setOptions(opt: Record<string, unknown>): typeof textile;
  function setoptions(opt: Record<string, unknown>): typeof textile;
  function parse(txt: string, opt?: Record<string, unknown>): string;
  namespace parse {
    export { textile as convert };
    export { parseHtml as html_parser };
    export function jsonml(txt: string, opt?: Record<string, unknown>): string[];
    export { toHTML as serialize };
  }
}
