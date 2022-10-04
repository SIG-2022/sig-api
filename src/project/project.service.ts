import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Client, STATE } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelParser } from './excel.parser';
import { ExcelWriter } from './excel.writer';

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private excelParser: ExcelParser,
    private excelWriter: ExcelWriter,
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

  async exportExcel() {
    return this.excelWriter.writeExcel();
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

  devs(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.DeveloperWhereUniqueInput;
    where?: Prisma.DeveloperWhereInput;
    orderBy?: Prisma.DeveloperOrderByWithRelationInput;
    include?: Prisma.DeveloperInclude;
  }) {
    const { skip, take, cursor, where, orderBy, include } = params;
    return this.prisma.developer.findMany({
      include,
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
  }

  underSelection(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.UnderSelectionDeveloperWhereUniqueInput;
    where?: Prisma.UnderSelectionDeveloperWhereInput;
    orderBy?: Prisma.UnderSelectionDeveloperOrderByWithRelationInput;
    include?: Prisma.UnderSelectionDeveloperInclude;
  }) {
    const { skip, take, cursor, where, orderBy, include } = params;
    return this.prisma.underSelectionDeveloper.findMany({
      include,
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
  }

  async assignTeam(data: {
    projectId: string;
    pmId: string;
    devs: string[];
    underSelection: string[];
  }) {
    const project = await this.prisma.project.findFirst({
      where: { id: data.projectId },
    });

    const pm = await this.prisma.pM.findFirst({
      where: { id: data.pmId },
    });
    if (!pm) throw new BadRequestException('PM not found');

    const devs = await this.prisma.developer.findMany({
      where: { id: { in: data.devs } },
    });
    let body = {
      pmId: data.pmId ? data.pmId : project.pmId,
      devs: undefined, //TODO check if undefined modifies devs list or remains unchanged
      underSelection: undefined,
    };

    if (devs.length !== data.devs.length) {
      throw new BadRequestException('Bad devs ids');
    } else {
      body = { devs: devs, ...body };
    }

    const underSelection = await this.prisma.underSelectionDeveloper.findMany({
      where: { id: { in: data.underSelection } },
    });

    if (underSelection.length !== data.underSelection.length) {
      throw new BadRequestException('Bad underSelection ids');
    } else {
      body = { underSelection: underSelection, ...body };
    }

    return this.prisma.project.update({
      where: { id: data.projectId },
      data: body,
    });
  }
}
