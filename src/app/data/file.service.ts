import { Injectable } from '@nestjs/common';
import {
  FileReferencesRow,
  getFileReferencesRows,
  getOnlyFileReferencesRowOrNull,
  getOnlyFileReferencesRowOrThrow,
  insertFileReferencesRow,
  OrganizationsRow,
  OrganizationsRowId,
} from 'src/DatabaseExtra';

@Injectable()
export class FileReferenceService {
  constructor() {}

  async createFileReference(organization: OrganizationsRow, file: Express.Multer.File, isWebsite: boolean) {
    const id = await insertFileReferencesRow({
      organizationId: organization.id,
      size: file.size,
      name: file.originalname,
      contentType: file.mimetype.split(';')[0],
      isWebsite: isWebsite ? 1 : 0,
    });
    return getOnlyFileReferencesRowOrThrow({ id });
  }

  async getFileReferences(organizationId: OrganizationsRowId): Promise<FileReferencesRow[]> {
    return getFileReferencesRows({ organizationId }, { order: { column: 'id', direction: 'DESC' } });
  }

  async getFileReference(organization: OrganizationsRow, hash: string) {
    return getOnlyFileReferencesRowOrNull({ organizationId: organization.id, hash });
  }
}
