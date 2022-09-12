import { Injectable } from '@nestjs/common';
import { Prisma, Project, Client } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

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
}
