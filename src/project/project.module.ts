import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelParser } from './excel.parser';
import { ExcelWriter } from './excel.writer';

@Module({
  controllers: [ProjectController],
  providers: [ProjectService, PrismaService, ExcelParser, ExcelWriter],
})
export class ProjectModule {}
