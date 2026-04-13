import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { ReposModule } from './repos/repos.module.js';
import { AnalysesModule } from './analyses/analyses.module.js';
import { GithubModule } from './github/github.module.js';

@Module({
  imports: [AuthModule, ReposModule, AnalysesModule, GithubModule],
})
export class AppModule {}
