import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { AnalysesService } from './analyses.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class AnalysesController {
  constructor(analysesService) {
    this.analysesService = analysesService;
  }

  @Post('repos/:id/analyze')
  async runAnalysis(@Request() req, @Param('id') repoId) {
    return this.analysesService.runAnalysis(req.user.id, repoId);
  }

  @Get('repos/:id/analyses')
  async getAnalyses(@Request() req, @Param('id') repoId) {
    return this.analysesService.getAnalyses(req.user.id, repoId);
  }

  @Get('analyses/:id')
  async getAnalysis(@Request() req, @Param('id') analysisId) {
    return this.analysesService.getAnalysis(req.user.id, analysisId);
  }

  @Post('analyses/:id/create-issue')
  async createIssue(@Request() req, @Param('id') analysisId) {
    return this.analysesService.createIssue(req.user.id, analysisId);
  }
}
