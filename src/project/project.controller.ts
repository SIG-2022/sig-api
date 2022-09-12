import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectService } from './project.service';
import { Prisma } from '@prisma/client';

@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createProject(
    @Body()
    data: {
      name: string;
      industry: string;
      studio: string;
      features: string[];
      client: { value: string; label: string };
      devAmount: number;
      maxBudget: number;
      endDate: Date;
    },
  ) {
    return this.projectService.createProject(data);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async listProject() {
    return this.projectService.projects({
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  @Get('clients')
  @UseGuards(JwtAuthGuard)
  async listClients() {
    return this.projectService.clients({});
  }
}
