import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Client, STATE, Project } from '@prisma/client';
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
    const projects = await this.prisma.project.findMany({
      include,
      skip,
      take,
      cursor,
      where,
      orderBy,
    });
    return Promise.all(
      projects.map(async (proj) => {
        const delay = await this.projectIsDelayed(proj);
        if (delay.delay) return { ...proj, delay: delay };
        return proj;
      }),
    );
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
      include: {
        pm: {
          include: {
            employee: true,
          },
        },
      },
      where: {
        id: id,
      },
    });
    // Rechazo → Si pm o dev delay delayCancel
    const delay = await this.projectIsDelayed(project);
    project.pmDelayCancel = delay.delay;
    if (project.pmId) {
      const pm = await this.prisma.pM.findFirst({
        select: {
          employee: true,
        },
        where: {
          id: project.pmId,
        },
      });
      if (pm.employee.availableDate > new Date()) project.pmDelayCancel = true;
    }

    const devs = await this.prisma.developer.findMany({
      select: { employee: true },
      where: { projectId: project.id },
    });
    devs.forEach((dev) => {
      if (dev.employee.availableDate > new Date()) project.pmDelayCancel = true;
    });

    const selection = await this.prisma.underSelectionDeveloper.findMany({
      select: { employee: true },
      where: { projectId: project.id },
    });
    selection.forEach((sel) => {
      if (sel.employee.availableDate > new Date()) project.pmDelayCancel = true;
    });

    const del = project.pmDelayCancel;
    await this.clearEmployees(project);

    return this.prisma.project.update({
      where: {
        id: id,
      },
      data: {
        pmDelayCancel: del,
        state: STATE.CANCELLED,
        cancelDate: new Date(),
      },
    });
  }

  private async clearEmployees(project: any) {
    const pmId = project.pmId;
    const pm = project.pm;
    project = await this.prisma.project.update({
      where: {
        id: project.id,
      },
      data: {
        pmId: null,
      },
    });
    // clear old employees
    if (pmId) {
      await this.prisma.pM.update({
        where: {
          id: pmId,
        },
        data: {
          employee: {
            update: {
              availableDate:
                project.state !== STATE.TEAM_ASSIGNMENT
                  ? new Date()
                  : pm.employee.availableDate,
            },
          },
        },
      });
    }

    const devs = await this.prisma.developer.findMany({
      include: {
        employee: true,
      },
      where: {
        projectId: project.id,
      },
    });

    const underSelection = await this.prisma.underSelectionDeveloper.findMany({
      include: {
        employee: true,
      },
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
                availableDate:
                  project.state !== STATE.TEAM_ASSIGNMENT
                    ? new Date()
                    : dev.employee.availableDate,
              },
            },
          },
        });
        await this.prisma.developer.update({
          where: {
            id: dev.id,
          },
          data: {
            projectId: null,
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
                availableDate:
                  project.state !== STATE.TEAM_ASSIGNMENT
                    ? new Date()
                    : und.employee.availableDate,
              },
            },
          },
        });
        await this.prisma.underSelectionDeveloper.update({
          where: {
            id: und.id,
          },
          data: {
            projectId: null,
          },
        });
      }),
    );
    return project;
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

    await this.prisma.pM
      .findFirst({
        where: { id: data.pmId },
      })
      .catch(() => {
        throw new BadRequestException('PM not found');
      });

    const devs = await this.prisma.developer
      .findMany({
        select: { employee: true },
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
      hadDelay: false,
    };

    if (data.pmId) {
      const pm = await this.prisma.pM.findFirst({
        select: {
          employee: true,
        },
        where: {
          id: data.pmId,
        },
      });
      if (pm.employee.availableDate > new Date()) body.hadDelay = true;
    }

    if (devs.length !== data.devs.length) {
      throw new BadRequestException('Bad devs ids');
    } else {
      body = { devs: devs, ...body };
    }

    devs.forEach((dev) => {
      if (dev.employee.availableDate > new Date()) body.hadDelay = true;
    });

    devs.forEach(async (dev) => {
      await this.prisma.developer.update({
        where: { id: dev.employee.id },
        data: { projectId: data.projectId },
      });
    });

    const underSelection = await this.prisma.underSelectionDeveloper
      .findMany({
        select: { employee: true },
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

    underSelection.forEach((sel) => {
      if (sel.employee.availableDate > new Date()) body.hadDelay = true;
    });

    underSelection.forEach(async (select) => {
      await this.prisma.underSelectionDeveloper.update({
        where: { id: select.employee.id },
        data: { projectId: data.projectId },
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
    const project = await this.prisma.project.findFirst({
      where: {
        id: id,
      },
    });

    return await this.prisma.project.update({
      where: { id: id },
      data: {
        state: STATE.ACCEPTED,
        acceptDate: new Date(),
        finishedCost: await this.getProjectPrice(project),
      },
    });
  }

  @Cron('59 58 23 * * *')
  async clearFinishedProjectEmployees() {
    console.log('Clearing done project employees...');
    const finishedProjects = await this.prisma.project.findMany({
      include: {
        pm: {
          include: {
            employee: true,
          },
        },
      },
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

  sum(result, item) {
    return result + item;
  }

  async getProjectPrice(project: Project) {
    if (project.state === STATE.ACCEPTED && project.finishedCost)
      return project.finishedCost;

    const days =
      (project.endDate.getTime() - project.startDate.getTime()) /
      (1000 * 3600 * 24);
    const monthFraction = days / 30;
    let total = 0;

    //pm
    if (project.pmId) {
      const pm = await this.prisma.pM.findFirst({
        select: {
          employee: true,
        },
        where: {
          id: project.pmId,
        },
      });
      total = total + pm.employee.salary * monthFraction;
    }

    //devs
    const devs = await this.prisma.developer.findMany({
      select: {
        employee: true,
      },
      where: {
        projectId: project.id,
      },
    });
    devs.forEach((dev) => {
      total = total + dev.employee.salary * monthFraction;
    });

    //underSelection
    const selection = await this.prisma.underSelectionDeveloper.findMany({
      select: {
        employee: true,
      },
      where: {
        projectId: project.id,
      },
    });
    selection.forEach((sel) => {
      total = total + sel.employee.salary * monthFraction;
    });
    return total;
  }

  getQuarter(date) {
    return Math.floor(date.getMonth() / 3 + 1);
  }

  daysDifference(date1, date2) {
    if (!date1 || !date2) return 0;
    return Math.abs(date2.getTime() - date1.getTime()) / (1000 * 3600 * 24);
  }

  async indicators() {
    const date = new Date();
    const monthFirstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthLastDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const monthConditions = [
      {
        startDate: { gte: monthFirstDay },
      },
      {
        endDate: { lte: monthLastDate },
      },
    ];

    const monthProjects = await this.prisma.project.findMany({
      include: {
        pm: {
          include: {
            employee: true,
          },
        },
      },
      where: {
        AND: [{ state: { not: STATE.CANCELLED } }, { OR: monthConditions }],
      },
    });

    const IDPM_valid = monthProjects.filter((proj) => proj.pmAssignDate);
    const IDPM =
      IDPM_valid.map((proj) => {
        return proj.pm?.employee.availableDate > proj.creationDate
          ? this.daysDifference(
              proj.pm?.employee.availableDate,
              proj.creationDate,
            )
          : 0;
      }).reduce(this.sum, 0) / IDPM_valid.length;

    const AP_approved = monthProjects.filter((proj) => proj.acceptDate);
    const AP_sent = monthProjects.filter((proj) => proj.sentDates?.length > 0);
    const AP = (AP_approved.length / AP_sent.length) * 100; // Mensual, (Presupuestos aprobados/Presupuestos enviados)*100

    const APPI_approved_first = monthProjects.filter(
      (proj) => proj.acceptDate && proj.sentDates.length === 1,
    );
    const APPI_all_approved = monthProjects.filter((proj) => proj.acceptDate);
    const APPI = (APPI_approved_first.length / APPI_all_approved.length) * 100; // Mensual, (Presupuestos aprobados en primera instancia/Presupuestos enviados en primera instancia)*100

    const MPP_proj = monthProjects.filter(
      (proj) => proj.state === STATE.ACCEPTED,
    );
    const MPP_price_map = await Promise.all(
      MPP_proj.map((proj) => this.getProjectPrice(proj)),
    );
    const MPP_price = MPP_price_map.reduce(this.sum, 0);
    const MPP_budget_map = await Promise.all(
      MPP_proj.map((proj) => proj.maxBudget),
    );
    const MPP_budget = MPP_budget_map.reduce(this.sum, 0);
    const MPP = ((MPP_budget - MPP_price) / MPP_budget) * 100; // Mensual, (Presupuesto-Costos totales)/Presupuesto) * 100

    const monthSelection = await this.prisma.underSelectionDeveloper.findMany({
      where: {
        OR: [
          { selectionStart: { gte: monthFirstDay } },
          { selectionEnd: { lte: monthLastDate } },
        ],
      },
    });
    const selectionTimeSum = monthSelection
      .map((sel) => this.daysDifference(sel.selectionEnd, sel.selectionStart))
      .reduce(this.sum, 0);
    const IDNE = selectionTimeSum / monthSelection.length; // Mensual, Suma de tiempo de contratación de cada empleado ingresante/Total empleados ingresantes
    // Sum(resta tiempo finalizacion seleccion - tiempo entrada) / total personas con fecha finalizacion

    const REPM_projects = await this.prisma.project.findMany({
      include: {
        pm: {
          include: {
            employee: true,
          },
        },
      },
      where: {
        OR: monthConditions,
      },
    });
    const REPM_hadDelay = REPM_projects.filter((proj) => proj.hadDelay);
    const REPM_delayCancel = REPM_projects.filter((proj) => proj.pmDelayCancel);
    // project.hadDelay == true si tuvo en algun momento delay y pmDelayCancel si cliente rechazo habiendo delay
    const REPM = (REPM_delayCancel.length / REPM_hadDelay.length) * 100; // Mensual, (Cantidad de veces que se rechazó el proyecto luego de informar el tiempo de demora/Cantidad de veces que se informó la demora)*100

    const IDE_team_assign = monthProjects.filter(
      (proj) => proj.lastDevAssignDate,
    );
    const IDE_team_assign_duration = IDE_team_assign.map((proj) =>
      this.daysDifference(proj.lastDevAssignDate, proj.pmAssignDate),
    ).reduce(this.sum, 0);
    const IDE = IDE_team_assign_duration / IDE_team_assign.length; // Mensual, Sum (tiempo fin asignacion equipo - tiempo asignacion PM) / equipos formados

    const quarterDates = [
      {
        start: new Date(date.getFullYear(), 0, 1),
        end: new Date(date.getFullYear(), 2, 31),
      },
      {
        start: new Date(date.getFullYear(), 3, 1),
        end: new Date(date.getFullYear(), 5, 30),
      },
      {
        start: new Date(date.getFullYear(), 6, 1),
        end: new Date(date.getFullYear(), 8, 30),
      },
      {
        start: new Date(date.getFullYear(), 9, 1),
        end: new Date(date.getFullYear(), 11, 31),
      },
    ];
    const quarter = quarterDates[this.getQuarter(new Date()) - 1];
    const quarterConditions = [
      {
        startDate: { gte: quarter.start },
      },
      {
        endDate: { lte: quarter.end },
      },
    ];
    const quarterProjects = await this.prisma.project.findMany({
      where: {
        AND: [{ state: { not: STATE.CANCELLED } }, { OR: quarterConditions }],
      },
      orderBy: {
        creationDate: 'asc',
      },
    });

    const newClients = await Promise.all(
      quarterProjects.map(async (proj) => {
        const sameClient = await this.prisma.project.findMany({
          where: {
            id: { not: proj.id },
            clientId: proj.clientId,
            creationDate: { lte: proj.creationDate },
            state: { not: STATE.CANCELLED },
          },
        });
        return {
          include: sameClient.length === 0,
          project: proj,
        };
      }),
    );

    const filtered = newClients.filter((itm) => itm.include);
    const ICN = (filtered.length / quarterProjects.length) * 100; // Trimestral, Proyectos para clientes nuevos / Proyectos totales *100

    const oldClients = await Promise.all(
      quarterProjects.map(async (proj) => {
        const sameClient = await this.prisma.project.findMany({
          where: {
            id: { not: proj.id },
            clientId: proj.clientId,
            creationDate: { lte: proj.creationDate },
            state: { not: STATE.CANCELLED },
          },
        });
        return {
          include: sameClient.length > 0,
          project: proj,
        };
      }),
    );
    const filtered2 = oldClients.filter((itm) => itm.include);
    const IR = (filtered2.length / quarterProjects.length) * 100; // Trimestral, Clientes que vuelven a contratar / clientes totales * 100

    return {
      IDPM: IDPM,
      AP: AP,
      APPI: APPI,
      MPP: MPP,
      IDNE: IDNE,
      REPM: REPM,
      IDE: IDE,
      ICN: ICN,
      IR: IR,
    };
  }

  private async projectIsDelayed(project) {
    let maxDelay = {
      delay: false,
      day: new Date(),
    };
    if (project.pmId) {
      const pm = await this.prisma.pM.findFirst({
        select: {
          employee: true,
        },
        where: {
          id: project.pmId,
        },
      });
      if (pm.employee.availableDate > new Date())
        maxDelay = { delay: true, day: pm.employee.availableDate };
    }

    const devs = await this.prisma.developer.findMany({
      select: { employee: true },
      where: { projectId: project.id },
    });
    devs.forEach((dev) => {
      if (dev.employee.availableDate > new Date()) {
        if (dev.employee.availableDate > maxDelay.day)
          maxDelay = { delay: true, day: dev.employee.availableDate };
        else maxDelay = { delay: true, day: maxDelay.day };
      }
    });

    const selection = await this.prisma.underSelectionDeveloper.findMany({
      select: { employee: true },
      where: { projectId: project.id },
    });
    selection.forEach((sel) => {
      if (sel.employee.availableDate > new Date()) {
        if (sel.employee.availableDate > maxDelay.day)
          maxDelay = { delay: true, day: sel.employee.availableDate };
        else maxDelay = { delay: true, day: maxDelay.day };
      }
    });

    return maxDelay;
  }
}
