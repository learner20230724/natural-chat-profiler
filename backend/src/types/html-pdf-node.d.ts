declare module 'html-pdf-node' {
  interface File {
    content: string;
    url?: string;
  }

  interface Options {
    format?: string;
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
    printBackground?: boolean;
    path?: string;
  }

  function generatePdf(file: File, options?: Options): Promise<Buffer>;
  function generatePdfs(files: File[], options?: Options): Promise<Buffer[]>;

  export { generatePdf, generatePdfs };
}
