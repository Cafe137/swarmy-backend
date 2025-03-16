import { Injectable } from '@nestjs/common';
import { ReadStream } from 'fs';
import * as imageThumbnail from 'image-thumbnail';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { FileReferencesRow } from '../../DatabaseExtra';

@Injectable()
export class ThumbnailService {
  constructor(
    @InjectPinoLogger(ThumbnailService.name)
    private readonly logger: PinoLogger,
  ) {}

  async safeCreateThumbnail(file: FileReferencesRow, data: ReadStream): Promise<string | null> {
    try {
      if (this.isImage(file.contentType)) {
        return await imageThumbnail(data, {
          width: 100,
          height: 100,
          responseType: 'base64',
        });
      }
    } catch (e) {
      this.logger.error(e, `Failed to create thumbnail for file ${file.id}`);
    }
    return null;
  }

  private isImage(mimetype: string) {
    return ['image/png', 'image/jpeg', 'image/webp'].includes(mimetype);
  }
}
