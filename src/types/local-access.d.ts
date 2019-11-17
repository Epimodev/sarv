declare module 'local-access' {
  interface Options {
    https?: boolean;
    hostname?: string;
    port?: number | string;
  }

  interface LocalAccess {
    local: string;
    network: string;
  }

  export default function(options?: Options): LocalAccess;
}
