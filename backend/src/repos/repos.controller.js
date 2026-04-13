import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ReposService } from './repos.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('repos')
@UseGuards(JwtAuthGuard)
export class ReposController {
  constructor(reposService) {
    this.reposService = reposService;
  }

  @Get()
  async getRepos(@Request() req) {
    return this.reposService.getRepos(req.user.id);
  }

  @Post()
  async addRepo(@Request() req, @Body() body) {
    const { owner, repo, githubToken } = body;
    if (!owner || !repo) {
      throw new Error('owner and repo are required');
    }
    return this.reposService.addRepo(req.user.id, owner, repo, githubToken);
  }

  @Get(':id')
  async getRepo(@Request() req, @Param('id') repoId) {
    return this.reposService.getRepo(req.user.id, repoId);
  }

  @Delete(':id')
  async deleteRepo(@Request() req, @Param('id') repoId) {
    return this.reposService.deleteRepo(req.user.id, repoId);
  }

  @Post('token')
  async updateToken(@Request() req, @Body() body) {
    const { githubToken } = body;
    if (!githubToken) throw new Error('githubToken is required');
    return this.reposService.updateGithubToken(req.user.id, githubToken);
  }
}
