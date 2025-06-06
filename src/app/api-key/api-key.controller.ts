import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiKeysRowId, UsersRow } from 'src/database/Schema';
import { UserInContext } from '../user/user.decorator';
import { ApiKeyService } from './api-key.service';

@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get('/')
  getApiKeys(@UserInContext() user: UsersRow) {
    return this.apiKeyService.getApiKeys(user.organizationId);
  }

  @Post('/')
  createApiKey(@UserInContext() user: UsersRow) {
    return this.apiKeyService.createApiKey(user.organizationId);
  }

  @Post('/named')
  createNamedApiKey(@UserInContext() user: UsersRow, @Body('name') name: string) {
    return this.apiKeyService.createNamedApiKey(user.organizationId, name);
  }

  @Put('/:id/rename')
  renameApiKey(@UserInContext() user: UsersRow, @Param('id') id: number, @Body('name') name: string) {
    return this.apiKeyService.renameApiKey(user.organizationId, id as ApiKeysRowId, name);
  }

  @Put('/:id/revoke')
  revokeApiKey(@Param('id') id: number) {
    return this.apiKeyService.revokeApiKey(id as ApiKeysRowId);
  }
}
