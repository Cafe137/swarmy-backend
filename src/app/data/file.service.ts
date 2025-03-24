import { Injectable } from '@nestjs/common';
import { runQuery } from 'src/Database';
import {
  FileReferencesRow,
  FileReferencesRowId,
  getFileReferencesRows,
  getOnlyFileReferencesRowOrThrow,
  insertDeletedFilesRow,
  insertFileReferencesRow,
  insertPublicHashesRow,
  OrganizationsRow,
  OrganizationsRowId,
  updatePublicHashesRow,
} from 'src/DatabaseExtra';
import { BeeService } from '../bee/bee.service';

@Injectable()
export class FileReferenceService {
  constructor(private beeService: BeeService) {}

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

  async deleteFileByHash(organization: OrganizationsRow, hash: string) {
    const files = await getFileReferencesRows({ organizationId: organization.id, hash });
    for (const file of files) {
      await insertDeletedFilesRow({
        archiveId: file.archiveId,
        contentType: file.contentType,
        hash: file.hash,
        name: file.name,
        organizationId: file.organizationId,
        originalCreatedAt: file.createdAt,
        size: file.size,
      });
      await runQuery('DELETE FROM fileReferences WHERE id = ?', file.id);
    }
  }

  async deleteFileById(organization: OrganizationsRow, id: FileReferencesRowId) {
    const file = await getOnlyFileReferencesRowOrThrow({ id, organizationId: organization.id });
    await insertDeletedFilesRow({
      archiveId: file.archiveId,
      contentType: file.contentType,
      hash: file.hash,
      name: file.name,
      organizationId: file.organizationId,
      originalCreatedAt: file.createdAt,
      size: file.size,
    });
    await runQuery('DELETE FROM fileReferences WHERE id = ?', id);
  }

  async getPublicDataViaBzz(hash: string, path?: string) {
    const rowId = await insertPublicHashesRow({ hash, kind: 'bzz' });
    const before = Date.now();
    const response = await this.beeService.getPublicDataViaBzz(hash, path);
    await updatePublicHashesRow(rowId, {
      durationMillis: Date.now() - before,
      size: response.data.length,
    });
    return response;
  }

  async getPublicDataViaBytes(hash: string) {
    const rowId = await insertPublicHashesRow({ hash, kind: 'bytes' });
    const before = Date.now();
    const response = await this.beeService.getPublicDataViaBytes(hash);
    await updatePublicHashesRow(rowId, {
      durationMillis: Date.now() - before,
      size: response.length,
    });
    return response;
  }
}
