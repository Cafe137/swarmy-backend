import { Bytes } from '@upcoming/bee-js';

export interface DownloadResult {
  headers: Record<string, string>;
  data: Bytes;
}
