export interface StaticServerOptions {
  host: string;
  port: number;
  index: string;
  fallback?: string;
  maxage: number;
  verbose: boolean;
}

export interface CompressedInfo {
  path: string;
  size: number;
}

export interface AvailableFile {
  path: string;
  contentType: string | null;
  size: number;
  modifiedTime: string;
  etag: string;
  gzip?: CompressedInfo;
  br?: CompressedInfo;
}

export interface AvailableFiles {
  [key: string]: AvailableFile | undefined;
}
