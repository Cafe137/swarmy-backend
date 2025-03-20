import { Injectable } from '@nestjs/common';
import {
  FileReferencesRow,
  getFileReferencesRows,
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
    hash: string,
    pathOnDisk: string,
  ) {
    const id = await insertFileReferencesRow({
      organizationId: organization.id,
      size,
      name,
      contentType,
      isWebsite: isWebsite ? 1 : 0,
      hash,
      pathOnDisk,
    });
    return getOnlyFileReferencesRowOrThrow({ id });
  }

  async getFileReferences(organizationId: OrganizationsRowId): Promise<FileReferencesRow[]> {
    return getFileReferencesRows({ organizationId }, { order: { column: 'id', direction: 'DESC' } });
  }

  async getFileReference(organization: OrganizationsRow, hash: string): Promise<FileReferencesRow | null> {
    const rows = await getFileReferencesRows({ organizationId: organization.id, hash }, { limit: 1 });
    return rows.length ? rows[0] : null;
  }
}
