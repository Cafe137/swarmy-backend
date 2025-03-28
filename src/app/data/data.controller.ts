import {
  Body,
  Controller,
  Delete,
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
import { Binary } from 'cafe-utility';
import { Request, Response } from 'express';
import { FileReferencesRowId, OrganizationsRow, UsersRow } from 'src/DatabaseExtra';
import { ApiKeyGuard } from '../api-key/api-key.guard';
import { Public } from '../auth/public.decorator';
import { OrganizationInContext } from '../organization/organization.decorator';
import { UserInContext } from '../user/user.decorator';
import { BinaryDataDto } from './binary-data.dto';
import { DownloadService } from './download.service';
import { FileReferenceService } from './file.service';
import { UploadResultDto } from './upload.result.dto';
import { UploadService } from './upload.service';
import { Utf8DataDto } from './utf8-data.dto';

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
  @Post('api/data/bin')
  uploadBinaryDataApi(
    @OrganizationInContext() organization: OrganizationsRow,
    @Body() dataDto: BinaryDataDto,
  ): Promise<UploadResultDto> {
    return this.uploadService.uploadBinaryData(
      organization,
      dataDto.name,
      dataDto.contentType,
      Binary.base64ToUint8Array(dataDto.base64),
    );
  }

  @Public()
  @UseGuards(ApiKeyGuard)
  @Post('api/data/utf8')
  uploadUtf8DataApi(
    @OrganizationInContext() organization: OrganizationsRow,
    @Body() dataDto: Utf8DataDto,
  ): Promise<UploadResultDto> {
    return this.uploadService.uploadUtf8Data(organization, dataDto.name, dataDto.contentType, dataDto.utf8);
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

  @Delete('files/hash/:hash')
  async deleteFileByHash(
    @OrganizationInContext() organization: OrganizationsRow,
    @Param('hash') hash: string,
    @Res() response: Response,
  ) {
    await this.fileReferenceService.deleteFileByHash(organization, hash);
    response.status(200).send();
  }

  @Delete('files/id/:id')
  async deleteFileById(
    @OrganizationInContext() organization: OrganizationsRow,
    @Param('id') id: number,
    @Res() response: Response,
  ) {
    await this.fileReferenceService.deleteFileById(organization, id as FileReferencesRowId);
    response.status(200).send();
  }

  @Public()
  @Get('bzz/:hash/*')
  async getPublicDataViaBzz(@Param('hash') hash: string, @Req() request: Request, @Res() response: Response) {
    const path = request.path.split(hash)[1];
    const result = await this.fileReferenceService.getPublicDataViaBzz(hash, path);
    return response
      .status(200)
      .header('Content-Type', result.contentType)
      .send(Buffer.from(result.data.toUint8Array()));
  }

  @Public()
  @Get('bytes/:hash')
  async getPublicDataViaBytes(@Param('hash') hash: string, @Res() response: Response) {
    const result = await this.fileReferenceService.getPublicDataViaBytes(hash);
    return response.status(200).send(Buffer.from(result.toUint8Array()));
  }
}
