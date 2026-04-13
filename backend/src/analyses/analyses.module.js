import { Module } from '@nestjs/common';
import { AnalysesController } from './analyses.controller.js';
import { AnalysesService } from './analyses.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GithubService } from '../github/github.service.js';

@Module({
  controllers: [AnalysesController],
  providers: [AnalysesService, PrismaService, GithubService],
})
export class AnalysesModule {}
