import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectService } from './project.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Workbook } from 'exceljs';

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

  @Post('/update')
  @UseGuards(JwtAuthGuard)
  async updateProject(
    @Body()
    data: {
      id: string;
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
    return this.projectService.updateProject(data);
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

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async cancelProject(@Param('id') id) {
    return this.projectService.cancelProject(id);
  }

  @Post('upload-data')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('File'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.projectService.parseExcel(file);
  }

  @Get('pm')
  @UseGuards(JwtAuthGuard)
  async listPms() {
    return this.projectService.pms({
      include: {
        employee: true,
      },
    });
  }
}
