import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'cafe-utility';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AlertService } from '../alert/alert.service';
import { GlacierClient, UploadArchiveCommand, UploadArchiveCommandInput } from '@aws-sdk/client-glacier';
import { Readable } from 'stream';

@Injectable()
export class GlacierService {
  private readonly vaultName: string;
  private readonly accountId: string;
  private readonly client: GlacierClient;

  constructor(
    @InjectPinoLogger(GlacierService.name)
    private readonly logger: PinoLogger,
    configService: ConfigService,
  ) {
    this.vaultName = Types.asString(configService.get<string>('GLACIER_VAULT_NAME'), { name: 'GLACIER_VAULT_NAME' });
    this.accountId = Types.asString(configService.get<string>('GLACIER_ACCOUNT_ID'), { name: 'GLACIER_ACCOUNT_ID' });
    const region = Types.asString(configService.get<string>('GLACIER_REGION'), { name: 'GLACIER_REGION' });
    const accessKeyId = Types.asString(configService.get<string>('GLACIER_ACCESS_KEY_ID'), {
      name: 'GLACIER_ACCESS_KEY_ID',
    });
    const secretAccessKey = Types.asString(configService.get<string>('GLACIER_SECRET_ACCESS_KEY'), {
      name: 'GLACIER_SECRET_ACCESS_KEY',
    });
    this.client = new GlacierClient({
      region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
  }

  async upload(data: Readable, description: string) {
    const params: UploadArchiveCommandInput = {
      vaultName: this.vaultName,
      body: data,
      accountId: this.accountId,
      archiveDescription: description,
    };

    const result = await this.client.send(new UploadArchiveCommand(params));
    this.logger.info(`Successfully archived file. ArchiveId: ${result.archiveId}`);
    return result;
  }
}
