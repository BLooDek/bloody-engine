declare module "pngjs" {
  export interface PNGOptions {
    width?: number;
    height?: number;
    data?: Buffer;
    filterType?: number;
  }

  export class PNG {
    width: number;
    height: number;
    data: Buffer;

    constructor(options?: PNGOptions);

    static sync: {
      read(buffer: Buffer): PNG;
      write(png: PNG): Buffer;
    };
  }

  export const PNG: {
    new (options?: PNGOptions): PNG;
    sync: {
      read(buffer: Buffer): PNG;
      write(png: PNG): Buffer;
    };
  };
}
