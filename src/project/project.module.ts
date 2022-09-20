import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelParser } from './excel.parser';

@Module({
  controllers: [ProjectController],
  providers: [ProjectService, PrismaService, ExcelParser],
})
export class ProjectModule {}
