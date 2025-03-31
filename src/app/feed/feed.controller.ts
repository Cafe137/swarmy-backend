import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { FeedsRowId, FileReferencesRowId, UsersRow } from 'src/database/Schema';
import { UserInContext } from '../user/user.decorator';
import { FeedDto } from './feed.dto';
import { FeedService } from './feed.service';

@Controller()
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('/feeds')
  async getFeedsForUser(@UserInContext() user: UsersRow) {
    return this.feedService.getAll(user.id);
  }

  @Post('/feeds')
  async createFeed(@UserInContext() user: UsersRow, @Body() payload: FeedDto) {
    return this.feedService.create(user.id, payload.name);
  }

  @Put('/feeds/:feedId/:fileId')
  async updateFeed(@UserInContext() user: UsersRow, @Param('feedId') feedId: number, @Param('fileId') fileId: number) {
    return this.feedService.update(user.id, feedId as FeedsRowId, fileId as FileReferencesRowId);
  }
}
