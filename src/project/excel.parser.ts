import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Workbook, Worksheet } from 'exceljs';

@Injectable()
export class ExcelParser {
  constructor(private prisma: PrismaService) {}

  async parseExcel(file: Express.Multer.File) {
    const workbook = new Workbook();
    await workbook.xlsx.load(file.buffer);
    const pmList = this.filterWorkbook(workbook, [
      'pm',
      'pms',
      'project manager',
      'project managers',
    ]);
    await this.parseEmployee(pmList, this.parsePM);
    const devList = this.filterWorkbook(workbook, [
      'dev',
      'devs',
      'desarrollador',
      'desarrolladores',
      'developer',
      'developers',
    ]);
    await this.parseEmployee(devList, this.parseDev);
    const selectionList = this.filterWorkbook(workbook, [
      'under selection',
      'selection',
      'en seleccion',
      'en selección',
      'desarrolladores en seleccion',
      'desarrolladores en selección',
      'desarrolladores en proceso de seleccion',
      'desarrolladores en proceso de selección',
    ]);
    await this.parseEmployee(selectionList, this.parseUnderSelectionDev);
  }

  filterWorkbook(workbook, names) {
    return workbook.worksheets.find((worksheet) => {
      const name = worksheet.name.toLowerCase();
      return names.includes(name);
    });
  }

  async parseEmployee(worksheet: Worksheet, parser) {
    const { top, bottom } = worksheet.dimensions;
    const headers = this.parseHeaders(worksheet);

    for (let i = top + 1; i <= bottom; i++) {
      const id = headers.id && worksheet.getRow(i).getCell(headers.id);
      const name = headers.name && worksheet.getRow(i).getCell(headers.name);
      const firstName =
        headers.firstName && worksheet.getRow(i).getCell(headers.firstName);
      const lastName =
        headers.lastName && worksheet.getRow(i).getCell(headers.lastName);
      const salary =
        headers.salary && worksheet.getRow(i).getCell(headers.salary);
      const date = headers.date && worksheet.getRow(i).getCell(headers.date);
      const fullName =
        firstName && lastName
          ? <string>firstName.value + ' ' + <string>lastName.value
          : name
          ? name.value
          : firstName.value;
      const data = {
        id: id.value.toString(),
        name: fullName.toString(),
        salary: <number>salary.value,
        availableDate: <Date>date.value,
      };
      const employee = await this.prisma.employee.upsert({
        where: { id: id.value.toString() },
        create: data,
        update: data,
      });
      parser(employee, worksheet.getRow(i), headers, this.prisma);
    }
  }

  parseHeaders(worksheet) {
    const { top } = worksheet.dimensions;
    const ids = ['id', 'documento'];
    const names = ['name', 'nombre'];
    const firstNames = ['nombre', 'name', 'first name', 'first_name'];
    const lastNames = ['apellido', 'last name', 'last_name'];
    const salaries = ['salario', 'sueldo', 'salary', 'pay', 'wage'];
    const dates = [
      'fecha',
      'fecha disponibilidad',
      'date',
      'date available',
      'fecha fin',
      'fecha finalizacion',
      'end date',
    ];
    const features = [
      'features',
      'characteristics',
      'caracteristicas',
      'características',
      'attributes',
    ];

    let headers = {
      id: undefined,
      name: undefined,
      firstName: undefined,
      lastName: undefined,
      salary: undefined,
      date: undefined,
      features: undefined,
    };
    worksheet.getRow(top).eachCell((header, col) => {
      switch (true) {
        case ids.includes(header.value.toString().toLowerCase()):
          headers = { ...headers, id: col };
          break;
        case firstNames.includes(header.value.toString().toLowerCase()):
          headers = { ...headers, firstName: col };
          break;
        case lastNames.includes(header.value.toString().toLowerCase()):
          headers = { ...headers, lastName: col };
          break;
        case names.includes(header.value.toString().toLowerCase()):
          headers = { ...headers, name: col };
          break;
        case salaries.includes(header.value.toString().toLowerCase()):
          headers = { ...headers, salary: col };
          break;
        case dates.includes(header.value.toString().toLowerCase()):
          headers = { ...headers, date: col };
          break;
        case features.includes(header.value.toString().toLowerCase()):
          headers = { ...headers, features: col };
          break;
        default:
          break;
      }
    });
    return headers;
  }

  async parsePM(employee, worksheetRow, headers, prisma) {
    const features = headers.features && worksheetRow.getCell(headers.features);
    const featuresList = features.value
      .split(',')
      .map((feature) => feature.trim());

    const createData = {
      id: employee.id,
      features: featuresList,
      employee: {
        connect: {
          id: employee.id,
        },
      },
    };

    const updateData = {
      id: employee.id,
      features: featuresList,
      employeeId: employee.id,
    };

    await prisma.pM.upsert({
      where: { id: employee.id },
      create: createData,
      update: updateData,
    });
  }

  async parseDev(employee, worksheetRow, headers, prisma) {
    const features = headers.features && worksheetRow.getCell(headers.features);
    const featuresList = features.value
      .split(',')
      .map((feature) => feature.trim());

    const data = {
      id: employee.id,
      features: featuresList,
      employee: {
        connect: {
          id: employee.id,
        },
      },
    };

    const updateData = {
      id: employee.id,
      features: featuresList,
      employeeId: employee.id,
    };

    const dev = await prisma.developer.upsert({
      where: { id: employee.id },
      create: data,
      update: updateData,
    });
  }

  async parseUnderSelectionDev(employee, worksheetRow, headers, prisma) {
    const date = headers.features && worksheetRow.getCell(headers.date);

    const data = {
      id: employee.id,
      selectionEnd: date,
      employee: {
        connect: {
          id: employee.id,
        },
      },
    };

    const updateData = {
      id: employee.id,
      selectionEnd: date,
      employeeId: employee.id,
    };

    const underSel = await prisma.underSelectionDeveloper.upsert({
      where: { id: employee.id },
      create: data,
      update: updateData,
    });
  }
}
