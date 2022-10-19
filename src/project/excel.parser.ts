import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Workbook, Worksheet } from 'exceljs';
import { EMPLOYEE_TYPE } from '@prisma/client';

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
    await this.parseEmployee(pmList, this.parsePM, EMPLOYEE_TYPE.PM);
    const devList = this.filterWorkbook(workbook, [
      'dev',
      'devs',
      'desarrollador',
      'desarrolladores',
      'developer',
      'developers',
      'consultores',
    ]);
    await this.parseEmployee(devList, this.parseDev, EMPLOYEE_TYPE.DEV);
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
    await this.parseEmployee(
      selectionList,
      this.parseUnderSelectionDev,
      EMPLOYEE_TYPE.UNDER_SELECTION,
    );
  }

  filterWorkbook(workbook, names) {
    return workbook.worksheets.find((worksheet) => {
      const name = worksheet.name.toLowerCase();
      return names.includes(name);
    });
  }

  async parseEmployee(worksheet: Worksheet, parser, employeeType) {
    const { top, bottom } = worksheet.dimensions;
    const headers = this.parseHeaders(worksheet);

    for (let i = top + 1; i <= bottom; i++) {
      const id = headers.id && worksheet.getRow(i).getCell(headers.id);
      const firstName =
        headers.firstName && worksheet.getRow(i).getCell(headers.firstName);
      const lastName =
        headers.lastName && worksheet.getRow(i).getCell(headers.lastName);
      const salary =
        headers.salary && worksheet.getRow(i).getCell(headers.salary);
      const date = headers.date && worksheet.getRow(i).getCell(headers.date);
      const phone = headers.phone && worksheet.getRow(i).getCell(headers.phone);
      const location =
        headers.location && worksheet.getRow(i).getCell(headers.location);
      const seniority =
        headers.seniority && worksheet.getRow(i).getCell(headers.seniority);
      const career =
        headers.career && worksheet.getRow(i).getCell(headers.career);

      const data = {
        id: id.value.toString(),
        name: firstName.value.toString(),
        surname: lastName.value.toString(),
        salary: <number>salary.value,
        phone: phone.value.toString(),
        location: location.value.toString(),
        seniority: <number>seniority.value,
        career: career.value.toString(),
        availableDate: <Date>date.value,
        type: employeeType,
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
    const firstNames = ['nombre', 'name', 'first name', 'first_name'];
    const lastNames = ['apellido', 'last name', 'last_name'];
    const salaries = ['salario', 'sueldo', 'salary', 'pay', 'wage'];
    const phones = ['phone', 'telefono', 'celular'];
    const locations = ['ubicacion', 'location'];
    const seniority = ['seniority', 'antiguedad'];
    const career = ['carrera', 'career'];
    const projectCount = ['project count', 'proyectos liderados'];
    const certificates = ['certificados'];
    const currentJob = ['trabajo anterior o actual'];
    const selectionStep = [
      'etapa en el proceso de selección',
      'etapa proceso',
      'etapa selección',
      'etapa seleccion',
      'etapa proceso seleccion',
      'etapa proceso de seleccion',
      'etapa proceso selección',
      'etapa proceso de selección',
    ];
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
      'tecnologias',
    ];

    let headers = {
      id: undefined,
      firstName: undefined,
      lastName: undefined,
      salary: undefined,
      date: undefined,
      features: undefined,
      phone: undefined,
      location: undefined,
      seniority: undefined,
      career: undefined,
      certificates: undefined,
      projectCount: undefined,
      currentJob: undefined,
      selectionStep: undefined,
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
        case phones.includes(header.value.toString().toLowerCase()):
          headers = { ...headers, phone: col };
          break;
        case locations.includes(header.value.toString().toLowerCase()):
          headers = { ...headers, location: col };
          break;
        case seniority.includes(header.value.toString().toLowerCase()):
          headers = { ...headers, seniority: col };
          break;
        case career.includes(header.value.toString().toLowerCase()):
          headers = { ...headers, career: col };
          break;
        case projectCount.includes(header.value.toString().toLowerCase()):
          headers = { ...headers, projectCount: col };
          break;
        case certificates.includes(header.value.toString().toLowerCase()):
          headers = { ...headers, certificates: col };
          break;
        case currentJob.includes(header.value.toString().toLowerCase()):
          headers = { ...headers, currentJob: col };
          break;
        case selectionStep.includes(header.value.toString().toLowerCase()):
          headers = { ...headers, selectionStep: col };
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
    const projectCount =
      headers.projectCount &&
      <number>worksheetRow.getCell(headers.projectCount).value;
    const featuresList = features.value
      .split(',')
      .map((feature) => feature.trim());

    const createData = {
      id: employee.id,
      features: featuresList,
      projectCount: projectCount,
      employee: {
        connect: {
          id: employee.id,
        },
      },
    };

    const updateData = {
      id: employee.id,
      features: featuresList,
      projectCount: projectCount,
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

    const certificates =
      headers.certificates && worksheetRow.getCell(headers.certificates);

    const featuresList = features.value
      .split(',')
      .map((feature) => feature.trim());

    const certificateList = certificates.value
      .split(',')
      .map((cert) => cert.trim());

    const data = {
      id: employee.id,
      technologies: featuresList,
      certificates: certificateList,
      employee: {
        connect: {
          id: employee.id,
        },
      },
    };

    const updateData = {
      id: employee.id,
      technologies: featuresList,
      certificates: certificateList,
      employeeId: employee.id,
    };

    await prisma.developer.upsert({
      where: { id: employee.id },
      create: data,
      update: updateData,
    });
  }

  async parseUnderSelectionDev(employee, worksheetRow, headers, prisma) {
    const technologies =
      headers.features && worksheetRow.getCell(headers.features);

    const technologiesList = technologies.value
      .split(',')
      .map((tech) => tech.trim());
    const availableDate = employee.availableDate;
    const currentJob =
      headers.currentJob && worksheetRow.getCell(headers.currentJob);
    const selectionStep =
      headers.selectionStep && worksheetRow.getCell(headers.selectionStep);

    const data = {
      id: employee.id,
      selectionEnd: availableDate,
      technologies: technologiesList,
      currentJob: currentJob.value.toString(),
      selectionStep: selectionStep.value.toString(),
      employee: {
        connect: {
          id: employee.id,
        },
      },
    };

    const updateData = {
      id: employee.id,
      selectionEnd: availableDate,
      technologies: technologiesList,
      currentJob: currentJob.value.toString(),
      selectionStep: selectionStep.value.toString(),
      employeeId: employee.id,
    };

    await prisma.underSelectionDeveloper.upsert({
      where: { id: employee.id },
      create: data,
      update: updateData,
    });
  }
}
