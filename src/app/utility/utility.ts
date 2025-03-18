import { MantarayNode, NULL_ADDRESS } from '@ethersphere/bee-js';

export function createManifestWrapper(name: string, contentType: string, rootHash: Uint8Array): MantarayNode {
  const manifest = new MantarayNode();
  manifest.addFork('/', NULL_ADDRESS, {
    'website-index-document': name,
  });
  manifest.addFork(name, rootHash, {
    'Content-Type': contentType,
    Filename: name,
  });
  return manifest;
}
