import { Bytes } from '@ethersphere/bee-js';

export interface DownloadResult {
  headers: Record<string, string>;
  data: Bytes;
}
