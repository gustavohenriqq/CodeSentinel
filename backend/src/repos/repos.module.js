import { Module } from '@nestjs/common';
import { ReposController } from './repos.controller.js';
import { ReposService } from './repos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GithubService } from '../github/github.service.js';

@Module({
  controllers: [ReposController],
  providers: [ReposService, PrismaService, GithubService],
})
export class ReposModule {}
