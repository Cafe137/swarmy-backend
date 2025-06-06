import { Injectable } from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  ApiKeysRow,
  ApiKeysRowId,
  getApiKeysRows,
  getOnlyApiKeysRowOrThrow,
  insertApiKeysRow,
  OrganizationsRowId,
  updateApiKeysRow,
} from 'src/database/Schema';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectPinoLogger(ApiKeyService.name)
    private readonly logger: PinoLogger,
  ) {}

  async createApiKey(organizationId: OrganizationsRowId): Promise<ApiKeysRow> {
    this.logger.info(`creating api key for organization ${organizationId}`);

    const id = await insertApiKeysRow({
      apiKey: randomStringGenerator(),
      organizationId,
      status: 'ACTIVE',
    });
    return getOnlyApiKeysRowOrThrow({ id });
  }

  async createNamedApiKey(organizationId: OrganizationsRowId, name: string): Promise<ApiKeysRow> {
    this.logger.info(`creating api key for organization ${organizationId}`);

    const id = await insertApiKeysRow({
      apiKey: randomStringGenerator(),
      organizationId,
      status: 'ACTIVE',
      label: name,
    });
    return getOnlyApiKeysRowOrThrow({ id });
  }

  async getApiKeys(organizationId: OrganizationsRowId): Promise<ApiKeysRow[]> {
    return getApiKeysRows({ organizationId });
  }

  async getApiKeyBySecret(secret: string): Promise<ApiKeysRow> {
    return getOnlyApiKeysRowOrThrow({ apiKey: secret });
  }

  async revokeApiKey(id: ApiKeysRowId): Promise<ApiKeysRow> {
    await updateApiKeysRow(id, { status: 'REVOKED' });
    return getOnlyApiKeysRowOrThrow({ id });
  }

  async renameApiKey(organizationId: OrganizationsRowId, id: ApiKeysRowId, label: string): Promise<ApiKeysRow> {
    await getOnlyApiKeysRowOrThrow({ id, organizationId });
    await updateApiKeysRow(id, { label });
    return getOnlyApiKeysRowOrThrow({ id });
  }
}
