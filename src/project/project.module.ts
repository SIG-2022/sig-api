import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelParser } from './excel.parser';
import { ExcelWriter } from './excel.writer';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  controllers: [ProjectController],
  providers: [ProjectService, PrismaService, ExcelParser, ExcelWriter],
  imports: [ScheduleModule.forRoot()],
})
export class ProjectModule {}
