import {
  Body,
  Controller,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { Binary, Types } from 'cafe-utility';
import { Request, Response } from 'express';
import { FileReferencesRowId, OrganizationsRow, UsersRow } from 'src/DatabaseExtra';
import { ApiKeyGuard } from '../api-key/api-key.guard';
import { Public } from '../auth/public.decorator';
import { OrganizationInContext } from '../organization/organization.decorator';
import { UserInContext } from '../user/user.decorator';
import { DataDto } from './data.dto';
import { DownloadService } from './download.service';
import { FileReferenceService } from './file.service';
import { UploadResultDto } from './upload.result.dto';
import { UploadService } from './upload.service';

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1gb

@Controller()
export class DataController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly downloadService: DownloadService,
    private readonly fileReferenceService: FileReferenceService,
  ) {}

  @Post('files')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @OrganizationInContext() organization: OrganizationsRow,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE })],
      }),
    )
    file: Express.Multer.File,
    @Body() body: any,
  ): Promise<UploadResultDto> {
    return this.uploadService.uploadFile(organization, file, body.website);
  }

  @Public()
  @UseGuards(ApiKeyGuard)
  @Post('api/files')
  @UseInterceptors(FileInterceptor('file'))
  uploadFileApi(
    @OrganizationInContext() organization: OrganizationsRow,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE })],
      }),
    )
    file: Express.Multer.File,
    @Query('website') website: boolean,
  ): Promise<UploadResultDto> {
    return this.uploadService.uploadFile(organization, file, website);
  }

  @Public()
  @UseGuards(ApiKeyGuard)
  @Post('api/data')
  uploadDataApi(
    @OrganizationInContext() organization: OrganizationsRow,
    @Body() dataDto: DataDto,
  ): Promise<UploadResultDto> {
    return this.uploadService.uploadData(
      organization,
      dataDto.name,
      dataDto.contentType,
      Binary.hexToUint8Array(dataDto.dataAsHex),
    );
  }

  @Public()
  @UseGuards(ApiKeyGuard)
  @Get('api/files')
  async getFileList(@OrganizationInContext() organization: OrganizationsRow) {
    const result = await this.fileReferenceService.getFileReferences(organization.id);
    return result.map((f) => ({
      hash: f.hash,
      name: f.name,
      contentType: f.contentType,
      size: f.size,
      hits: f.hits,
      createdAt: f['createdAt'],
    }));
  }

  @Public()
  @UseGuards(ApiKeyGuard)
  @Get('files/:hash')
  async downloadFile(
    @OrganizationInContext() organization: OrganizationsRow,
    @Param('hash') hash: string,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    const result = await this.downloadService.download(organization, hash);
    for (const key in result.headers) {
      response.header(key, result.headers[key]);
    }
    return response.status(200).cookie('k', request.get('key')).send(Buffer.from(result.data.toUint8Array()));
  }

  @Public()
  @UseGuards(ApiKeyGuard)
  @Get('fileIds/:id')
  async downloadFileById(
    @OrganizationInContext() organization: OrganizationsRow,
    @Param('id') id: number,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    const result = await this.downloadService.downloadById(organization, Types.asId(id) as FileReferencesRowId);
    for (const key in result.headers) {
      response.header(key, result.headers[key]);
    }
    return response.status(200).cookie('k', request.get('key')).send(Buffer.from(result.data.toUint8Array()));
  }

  @Public()
  @UseGuards(ApiKeyGuard)
  @Get('files/:hash/*')
  async downloadEmbeddedFile(
    @OrganizationInContext() organization: OrganizationsRow,
    @Param('hash') hash: string,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    try {
      const path = request.path.split(hash)[1];
      const result = await this.downloadService.download(organization, hash, path);
      for (const key in result.headers) {
        response.header(key, result.headers[key]);
      }
      return response.status(200).send(Buffer.from(result.data.toUint8Array()));
    } catch (error) {
      return response.status(404).json({ message: 'not found' });
    }
  }

  @Get('file-references')
  getFileReferencesForUser(@UserInContext() user: UsersRow) {
    return this.fileReferenceService.getFileReferences(user.organizationId);
  }
}
