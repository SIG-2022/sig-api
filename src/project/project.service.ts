import { Injectable } from '@nestjs/common';
import { Prisma, Client, STATE } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelParser } from './excel.parser';

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private excelParser: ExcelParser,
  ) {}

  async createProject(data: {
    name: string;
    industry: string;
    studio: string;
    features: string[];
    client;
    devAmount: number;
    maxBudget: number;
    endDate: Date;
  }) {
    data.endDate = new Date();
    data.client = data.client.value
      ? {
          connect: {
            id: data.client.value,
          },
        }
      : {
          create: {
            name: data.client.label,
          },
        };

    return this.prisma.project.create({
      data,
    });
  }

  updateProject(data: {
    id: string;
    name: string;
    industry: string;
    studio: string;
    features: string[];
    client;
    devAmount: number;
    maxBudget: number;
    endDate: Date;
  }) {
    data.endDate = new Date();
    data.client = data.client.value
      ? {
          connect: {
            id: data.client.value,
          },
        }
      : {
          create: {
            name: data.client.label,
          },
        };

    return this.prisma.project.update({
      where: {
        id: data.id,
      },
      data: data,
    });
  }

  async projects(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.ProjectWhereUniqueInput;
    where?: Prisma.ProjectWhereInput;
    orderBy?: Prisma.ProjectOrderByWithRelationInput;
    include?: Prisma.ProjectInclude;
  }) {
    const { skip, take, cursor, where, orderBy, include } = params;
    return this.prisma.project.findMany({
      include,
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
  }

  async clients(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.ClientWhereUniqueInput;
    where?: Prisma.ClientWhereInput;
    orderBy?: Prisma.ClientOrderByWithRelationInput;
  }): Promise<Client[]> {
    const { skip, take, cursor, where, orderBy } = params;
    return this.prisma.client.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
  }

  async cancelProject(id) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: id,
      },
    });

    project.state = STATE.CANCELLED;

    return this.prisma.project.update({
      where: {
        id: id,
      },
      data: project,
    });
  }

  async parseExcel(file: Express.Multer.File) {
    await this.excelParser.parseExcel(file);
  }

  pms(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.PMWhereUniqueInput;
    where?: Prisma.PMWhereInput;
    orderBy?: Prisma.PMOrderByWithRelationInput;
    include?: Prisma.PMInclude;
  }) {
    const { skip, take, cursor, where, orderBy, include } = params;
    return this.prisma.pM.findMany({
      include,
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
  }
}
