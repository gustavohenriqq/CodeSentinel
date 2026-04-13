import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GithubService } from '../github/github.service.js';
import { analyzeWorkflows } from './engine/analyzer.js';

@Injectable()
export class AnalysesService {
  constructor(prisma, githubService) {
    this.prisma = prisma;
    this.githubService = githubService;
  }

  async runAnalysis(userId, repoId) {
    // Make sure the repo belongs to this user
    const repo = await this.prisma.repository.findFirst({
      where: { id: repoId, userId },
      include: { user: true },
    });

    if (!repo) {
      throw new NotFoundException('Repository not found');
    }

    if (!repo.user.githubToken) {
      throw new ForbiddenException('No GitHub token configured. Please add your token in settings.');
    }

    // Fetch workflow files from GitHub
    const workflowFiles = await this.githubService.getWorkflowFiles(
      repo.user.githubToken,
      repo.owner,
      repo.name,
    );

    // Run analysis engine
    const result = analyzeWorkflows(workflowFiles);

    // Save analysis to database
    const analysis = await this.prisma.analysis.create({
      data: {
        repositoryId: repoId,
        score: result.score,
        totalFindings: result.totalFindings,
        criticalCount: result.criticalCount,
        highCount: result.highCount,
        mediumCount: result.mediumCount,
        lowCount: result.lowCount,
        status: 'completed',
        findings: {
          create: result.findings.map(f => ({
            title: f.title,
            description: f.description,
            severity: f.severity,
            file: f.file,
            reference: f.reference || null,
            reason: f.reason,
            suggestion: f.suggestion,
          })),
        },
      },
      include: { findings: true },
    });

    return analysis;
  }

  async getAnalyses(userId, repoId) {
    const repo = await this.prisma.repository.findFirst({
      where: { id: repoId, userId },
    });

    if (!repo) {
      throw new NotFoundException('Repository not found');
    }

    return this.prisma.analysis.findMany({
      where: { repositoryId: repoId },
      orderBy: { createdAt: 'desc' },
      include: {
        findings: true,
        issueLogs: true,
      },
    });
  }

  async getAnalysis(userId, analysisId) {
    const analysis = await this.prisma.analysis.findFirst({
      where: { id: analysisId },
      include: {
        findings: { orderBy: { severity: 'asc' } },
        repository: true,
        issueLogs: true,
      },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found');
    }

    if (analysis.repository.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return analysis;
  }

  async createIssue(userId, analysisId) {
    const analysis = await this.getAnalysis(userId, analysisId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user.githubToken) {
      throw new ForbiddenException('No GitHub token configured.');
    }

    // Check if issue was already created
    if (analysis.issueLogs.length > 0) {
      return {
        message: 'Issue already created for this analysis',
        issueUrl: analysis.issueLogs[0].issueUrl,
      };
    }

    // Build issue body
    const issueBody = this.buildIssueBody(analysis);
    const title = `[CodeSentinel] Security Audit - Score: ${analysis.score}/100`;

    const { url, number } = await this.githubService.createIssue(
      user.githubToken,
      analysis.repository.owner,
      analysis.repository.name,
      title,
      issueBody,
    );

    // Log the issue
    await this.prisma.issueLog.create({
      data: {
        analysisId,
        issueUrl: url,
        issueNumber: number,
      },
    });

    return { issueUrl: url, issueNumber: number };
  }

  buildIssueBody(analysis) {
    const repo = analysis.repository;
    const date = new Date(analysis.createdAt).toLocaleDateString('en-US');
    const scoreEmoji = analysis.score >= 80 ? '🟢' : analysis.score >= 60 ? '🟡' : analysis.score >= 40 ? '🟠' : '🔴';

    const findingsBySeverity = {
      critical: analysis.findings.filter(f => f.severity === 'critical'),
      high: analysis.findings.filter(f => f.severity === 'high'),
      medium: analysis.findings.filter(f => f.severity === 'medium'),
      low: analysis.findings.filter(f => f.severity === 'low'),
    };

    let body = `## ${scoreEmoji} CodeSentinel Security Audit Report

**Repository:** \`${repo.fullName}\`
**Date:** ${date}
**Risk Score:** ${analysis.score}/100
**Total Findings:** ${analysis.totalFindings}

### Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | ${analysis.criticalCount} |
| 🟠 High | ${analysis.highCount} |
| 🟡 Medium | ${analysis.mediumCount} |
| 🟢 Low | ${analysis.lowCount} |

---

`;

    for (const [severity, findings] of Object.entries(findingsBySeverity)) {
      if (findings.length === 0) continue;

      const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[severity];
      body += `### ${emoji} ${severity.charAt(0).toUpperCase() + severity.slice(1)} Severity\n\n`;

      for (const finding of findings) {
        body += `#### ${finding.title}\n`;
        body += `**File:** \`${finding.file}\`\n\n`;
        body += `${finding.description}\n\n`;
        body += `**Why this matters:** ${finding.reason}\n\n`;
        body += `**Suggestion:** ${finding.suggestion}\n\n`;
        if (finding.reference) {
          body += `**Reference:** ${finding.reference}\n\n`;
        }
        body += `---\n\n`;
      }
    }

    body += `\n\n*Generated by [CodeSentinel](https://github.com) — Your code's first line of defense.*`;

    return body;
  }
}
