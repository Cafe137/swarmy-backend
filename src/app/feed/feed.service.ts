import { Injectable } from '@nestjs/common';
import { Binary, Strings } from 'cafe-utility';
import { runQuery } from 'src/Database';
import {
  FeedsRow,
  FeedsRowId,
  FileReferencesRowId,
  getFeedsRows,
  getOnlyFeedsRowOrThrow,
  getOnlyFileReferencesRowOrThrow,
  getOnlyOrganizationsRowOrThrow,
  getOnlyUsersRowOrThrow,
  insertFeedItemsRow,
  insertFeedsRow,
  updateFeedsRow,
  UsersRowId,
} from 'src/DatabaseExtra';
import { BeeService } from '../bee/bee.service';

@Injectable()
export class FeedService {
  constructor(private readonly beeService: BeeService) {}

  async getAll(userId: UsersRowId): Promise<Omit<FeedsRow, 'privateKey'>[]> {
    const feeds = await getFeedsRows({ userId });
    return feeds.map((feed) => {
      return {
        id: feed.id,
        name: feed.name,
        updates: feed.updates,
        organizationId: feed.organizationId,
        userId: feed.userId,
        feedAddress: feed.feedAddress,
        lastBzzAddress: feed.lastBzzAddress,
        manifestAddress: feed.manifestAddress,
        createdAt: feed.createdAt,
        updatedAt: feed.updatedAt,
      };
    });
  }

  async create(userId: UsersRowId, name: string) {
    const user = await getOnlyUsersRowOrThrow({ id: userId });
    const organization = await getOnlyOrganizationsRowOrThrow({ id: user.organizationId });
    const privateKey = Strings.randomHex(64);
    await insertFeedsRow({ userId, organizationId: organization.id, name, privateKey });
  }

  async update(userId: UsersRowId, feedId: FeedsRowId, fileReferenceId: FileReferencesRowId) {
    const feed = await getOnlyFeedsRowOrThrow({ id: feedId, userId });
    const organization = await getOnlyOrganizationsRowOrThrow({ id: feed.organizationId });
    if (!organization.postageBatchId) {
      throw Error('Organization does not have a postage batch id');
    }
    const fileReference = await getOnlyFileReferencesRowOrThrow({
      id: fileReferenceId,
      organizationId: organization.id,
    });
    const feedUpdateResult = await this.beeService.updateFeed(
      organization.postageBatchId,
      Binary.hexToUint8Array(feed.privateKey),
      fileReference.hash,
    );
    await runQuery('DELETE FROM swarmy.feedItems WHERE feedId = ?', feedId);
    await insertFeedItemsRow({ feedId, fileReferenceId });
    await updateFeedsRow(feed.id, {
      manifestAddress: feedUpdateResult.manifest,
      feedAddress: feedUpdateResult.reference,
      lastBzzAddress: fileReference.hash,
    });
  }
}
