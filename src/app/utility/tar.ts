import { Bee, MantarayNode, NULL_ADDRESS, Reference } from '@ethersphere/bee-js';
import { AsyncQueue, Chunk, MerkleTree, Strings } from 'cafe-utility';
import { createReadStream } from 'fs';
import tar from 'tar-stream';
import { mimes } from './mime';

export async function uploadTar(bee: Bee, batchId: string, pathToTar: string): Promise<Reference> {
  const queue = new AsyncQueue(64, 64);
  async function onChunk(chunk: Chunk) {
    await queue.enqueue(async () => {
      await bee.uploadChunk(batchId, chunk.build());
    });
  }
  const mantaray = await handleTar(pathToTar, onChunk);
  const result = await mantaray.saveRecursively(bee, batchId);
  return result.reference;
}

export async function predictTarRootHash(pathToTar: string): Promise<Reference> {
  const mantaray = await handleTar(pathToTar);
  return mantaray.calculateSelfAddress();
}

async function handleTar(pathToTar: string, onChunk = MerkleTree.NOOP): Promise<MantarayNode> {
  const commonDirectory = await findCommonDirectory(pathToTar);
  const mantaray = new MantarayNode();
  const extract = tar.extract();
  const readStream = createReadStream(pathToTar);
  readStream.pipe(extract);
  for await (const entry of extract) {
    const filename = entry.header.name.slice(commonDirectory.length);
    if (filename) {
      const tree = new MerkleTree(onChunk);
      for await (const chunk of entry) {
        await tree.append(chunk);
      }
      const rootChunk = await tree.finalize();
      const extension = Strings.getExtension(filename);
      mantaray.addFork(filename, rootChunk.hash(), {
        'Content-Type': mimes[extension.toLowerCase()] || 'application/octet-stream',
        Filename: filename,
      });
      if (filename === 'index.html') {
        mantaray.addFork('/', NULL_ADDRESS, {
          'website-index-document': 'index.html',
        });
      }
    }
    entry.resume();
  }
  return mantaray;
}

async function findCommonDirectory(pathToTar: string): Promise<string> {
  const filenames: string[] = [];
  const extract = tar.extract();
  const readStream = createReadStream(pathToTar);
  readStream.pipe(extract);
  for await (const entry of extract) {
    filenames.push(entry.header.name);
    entry.resume();
  }
  return Strings.findCommonDirectory(filenames);
}
