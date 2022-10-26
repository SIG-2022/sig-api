import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Client, STATE } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelParser } from './excel.parser';
import { ExcelWriter } from './excel.writer';
import { Cron } from '@nestjs/schedule';

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
    startDate: Date;
    requirement: string;
    creationDate: Date;
  }) {
    data.client = {
      connect: {
        id: data.client.value,
      },
    };

    data.creationDate = new Date();

    const project = await this.prisma.project.create({
      data,
    });

    const client = await this.prisma.client.findFirst({
      where: {
        id: data.client.value,
      },
    });

    client.pastProjects.push(project.id);

    await this.prisma.client.update({
      where: {
        id: client.id,
      },
      data: {
        ...client,
      },
    });

    return project;
  }

  async updateProject(data: {
    id: string;
    name: string;
    industry: string;
    studio: string;
    features: string[];
    client;
    devAmount: number;
    maxBudget: number;
    endDate: Date;
    startDate: Date;
    requirement: string;
  }) {
    data.endDate = new Date();
    data.client = {
      connect: {
        id: data.client.value,
      },
    };

    const client = await this.prisma.client.findFirst({
      where: {
        id: data.client.value,
      },
    });

    if (!client.pastProjects.includes(data.id))
      client.pastProjects.push(data.id);

    await this.prisma.client.update({
      where: {
        id: client.id,
      },
      data: {
        ...client,
      },
    });

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
    // Rechazo → Si no hay asignacion de pm → pmDelayCancel
    if (!project.pmId) project.pmDelayCancel = true;

    project.state = STATE.CANCELLED;
    project.cancelDate = new Date();

    await this.clearEmployees(project);

    return this.prisma.project.update({
      where: {
        id: id,
      },
      data: project,
    });
  }

  private async clearEmployees(project: any) {
    // clear old employees
    if (project.pmId) {
      await this.prisma.pM.update({
        where: {
          id: project.pmId,
        },
        data: {
          project: null,
          employee: {
            update: {
              availableDate: new Date(),
            },
          },
        },
      });
    }

    const devs = await this.prisma.developer.findMany({
      where: {
        projectId: project.id,
      },
    });

    const underSelection = await this.prisma.underSelectionDeveloper.findMany({
      where: {
        projectId: project.id,
      },
    });

    await Promise.all(
      devs.map(async (dev) => {
        await this.prisma.developer.update({
          where: {
            id: dev.id,
          },
          data: {
            employee: {
              update: {
                availableDate: new Date(),
              },
            },
          },
        });
      }),
    );

    await Promise.all(
      underSelection.map(async (und) => {
        await this.prisma.underSelectionDeveloper.update({
          where: {
            id: und.id,
          },
          data: {
            employee: {
              update: {
                availableDate: new Date(),
              },
            },
          },
        });
      }),
    );
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
    const proj = await this.prisma.project
      .findFirst({
        where: { id: data.projectId },
      })
      .catch(() => {
        throw new BadRequestException('Project not found');
      });
    const date = proj.creationDate;
    date.setDate(date.getDate() + 1);
    const delayPass = date < new Date();
    //Assign pm → (Si fechaCreacion + 1 dia < currentTime) = pmDelayedPass

    await this.prisma.pM
      .findFirst({
        where: { id: data.pmId },
      })
      .catch(() => {
        throw new BadRequestException('PM not found');
      });

    const devs = await this.prisma.developer
      .findMany({
        where: { id: { in: data.devs } },
      })
      .catch(() => {
        throw new BadRequestException('Dev not found');
      });

    const projectDevs = await this.prisma.developer.findMany({
      where: { projectId: proj.id },
    });

    // No devs previously assigned and assigned now --> firstDevTime set
    const firstDevAssignDate =
      data.devs.length > 0 && projectDevs.length === 0 ? new Date() : undefined;

    // All devs assigned --> lastDevTime set
    const lastDevAssignDate =
      data.devs.length + data.underSelection.length === proj.devAmount
        ? new Date()
        : undefined;

    let body = {
      pmId: data.pmId ? data.pmId : undefined,
      pmAssignDate: data.pmId ? new Date() : undefined,
      firstDevAssignDate: firstDevAssignDate,
      lastDevAssignDate: lastDevAssignDate,
      devs: undefined,
      underSelection: undefined,
      state: proj.state,
      pmDelayPass: delayPass,
    };

    if (devs.length !== data.devs.length) {
      throw new BadRequestException('Bad devs ids');
    } else {
      body = { devs: devs, ...body };
    }

    devs.forEach(async (dev) => {
      await this.prisma.developer.update({
        where: { id: dev.employeeId },
        data: { ...dev, projectId: data.projectId },
      });
    });

    const underSelection = await this.prisma.underSelectionDeveloper
      .findMany({
        where: { id: { in: data.underSelection } },
      })
      .catch(() => {
        throw new BadRequestException('Under selection not found');
      });

    if (underSelection.length !== data.underSelection.length) {
      throw new BadRequestException('Bad underSelection ids');
    } else {
      body = { underSelection: underSelection, ...body };
    }

    underSelection.forEach(async (select) => {
      await this.prisma.underSelectionDeveloper.update({
        where: { id: select.employeeId },
        data: { ...select, projectId: data.projectId },
      });
    });

    if (underSelection.length + devs.length === proj.devAmount) {
      body = { ...body, state: STATE.TEAM_ASSIGNED };
    }

    return this.prisma.project.update({
      where: { id: data.projectId },
      data: body,
    });
  }

  createClient(data: {
    name: string;
    cuit: number;
    location: string;
    industry: string;
    email: string;
    phone: string;
  }) {
    return this.prisma.client.create({
      data: {
        name: data.name,
        cuit: data.cuit,
        location: data.location,
        industry: data.industry,
        email: data.email,
        phone: data.phone,
      },
    });
  }

  async sendToClient(id: string) {
    return await this.prisma.project.update({
      where: { id: id },
      data: {
        state: STATE.SENT_TO_CLIENT,
        sentCount: { increment: 1 },
        sentDates: {
          push: new Date(),
        },
      },
    });
  }

  async clientRejected(id: string) {
    return await this.prisma.project.update({
      where: { id: id },
      data: {
        state: STATE.REJECTED_BY_CLIENT,
        rejectDates: {
          push: new Date(),
        },
      },
    });
  }

  async clientAccepted(id: string) {
    return await this.prisma.project.update({
      where: { id: id },
      data: { state: STATE.ACCEPTED, acceptDate: new Date() },
    });
  }

  @Cron('59 58 23 * * *')
  async clearFinishedProjectEmployees() {
    console.log('Clearing done project employees...');
    const finishedProjects = await this.prisma.project.findMany({
      where: {
        state: STATE.ACCEPTED,
        endDate: { lte: new Date() },
      },
    });
    await Promise.all(
      finishedProjects.map(async (proj) => {
        await this.clearEmployees(proj);
      }),
    );
    console.log('Finished clearing done project employees...');
  }
}
