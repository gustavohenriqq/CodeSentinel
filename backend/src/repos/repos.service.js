import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GithubService } from '../github/github.service.js';

@Injectable()
export class ReposService {
  constructor(prisma, githubService) {
    this.prisma = prisma;
    this.githubService = githubService;
  }

  async getRepos(userId) {
    return this.prisma.repository.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            score: true,
            totalFindings: true,
            criticalCount: true,
            highCount: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async addRepo(userId, owner, repoName, githubToken) {
    // Get user to check if they have a token stored
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const token = githubToken || user.githubToken;

    if (!token) {
      throw new ConflictException('No GitHub token provided. Please add a token to connect repositories.');
    }

    // Save token for future use if provided
    if (githubToken) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { githubToken },
      });
    }

    // Validate repo exists on GitHub
    const ghRepo = await this.githubService.getRepo(token, owner, repoName);

    // Check if already added
    const existing = await this.prisma.repository.findFirst({
      where: { userId, fullName: ghRepo.full_name },
    });

    if (existing) {
      throw new ConflictException('Repository already added');
    }

    return this.prisma.repository.create({
      data: {
        userId,
        owner: ghRepo.owner.login,
        name: ghRepo.name,
        fullName: ghRepo.full_name,
        url: ghRepo.html_url,
        private: ghRepo.private,
      },
    });
  }

  async getRepo(userId, repoId) {
    const repo = await this.prisma.repository.findFirst({
      where: { id: repoId, userId },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          include: {
            findings: true,
            issueLogs: true,
          },
        },
      },
    });

    if (!repo) {
      throw new NotFoundException('Repository not found');
    }

    return repo;
  }

  async deleteRepo(userId, repoId) {
    const repo = await this.prisma.repository.findFirst({
      where: { id: repoId, userId },
    });

    if (!repo) {
      throw new NotFoundException('Repository not found');
    }

    await this.prisma.repository.delete({ where: { id: repoId } });
    return { message: 'Repository removed successfully' };
  }

  async updateGithubToken(userId, githubToken) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { githubToken },
    });
    return { message: 'GitHub token updated successfully' };
  }
}
