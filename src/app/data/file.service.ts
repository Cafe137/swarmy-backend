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

  async createFileReference(
    organization: OrganizationsRow,
    size: number,
    name: string,
    contentType: string,
    isWebsite: boolean,
    rootHash: string,
  ) {
    const id = await insertFileReferencesRow({
      organizationId: organization.id,
      size,
      name,
      contentType,
      isWebsite: isWebsite ? 1 : 0,
      hash: rootHash,
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
