import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Workbook, Worksheet } from 'exceljs';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class ExcelWriter {
  constructor(private prisma: PrismaService) {}

  async writeExcel() {
    const workbook = new Workbook();
    const pmSheet = workbook.addWorksheet('Pms');
    await this.addPms(pmSheet);

    const devSheet = workbook.addWorksheet('Consultores');
    await this.addDevs(devSheet);

    const underSelectionSheet = workbook.addWorksheet('En selección');
    await this.addUnderSelection(underSelectionSheet);

    const filePath = join(__dirname, 'excelExport.xlsx');
    await workbook.xlsx.writeFile(filePath);
    return { data: fs.readFileSync(filePath).toString('base64') };
  }

  async addPms(worksheet: Worksheet) {
    worksheet
      .addRow([
        'id',
        'nombre',
        'apellido',
        'salario',
        'fecha',
        'caraceristicas',
        'telefono',
        'ubicacion',
        'antiguedad',
        'proyectos liderados',
      ])
      .commit();
    const pms = await this.prisma.pM.findMany({ include: { employee: true } });
    pms.forEach((pm) => {
      worksheet
        .addRow([
          pm.id,
          pm.employee.name,
          pm.employee.surname,
          pm.employee.salary,
          pm.employee.availableDate,
          pm.features.toString(),
          pm.employee.phone,
          pm.employee.location,
          pm.employee.seniority,
          pm.projectCount,
        ])
        .commit();
    });
  }

  private async addDevs(devSheet: Worksheet) {
    devSheet
      .addRow([
        'id',
        'nombre',
        'apellido',
        'salario',
        'fecha',
        'tecnologias',
        'telefono',
        'ubicacion',
        'antiguedad',
        'carrera',
        'certificados',
      ])
      .commit();
    const devs = await this.prisma.developer.findMany({
      include: { employee: true },
    });
    devs.forEach((dev) => {
      devSheet
        .addRow([
          dev.id,
          dev.employee.name,
          dev.employee.surname,
          dev.employee.salary,
          dev.employee.availableDate,
          dev.technologies.toString(),
          dev.employee.phone,
          dev.employee.location,
          dev.employee.seniority,
          dev.employee.career,
          dev.certificates.toString(),
        ])
        .commit();
    });
  }

  private async addUnderSelection(underSelectionSheet: Worksheet) {
    underSelectionSheet
      .addRow([
        'id',
        'nombre',
        'apellido',
        'salario',
        'fecha',
        'telefono',
        'ubicacion',
        'carrera',
        'tecnologias',
        'trabajo actual o anterior',
        'etapa proceso de seleccion',
      ])
      .commit();

    const devs = await this.prisma.underSelectionDeveloper.findMany({
      include: { employee: true },
    });
    devs.forEach((dev) => {
      underSelectionSheet
        .addRow([
          dev.id,
          dev.employee.name,
          dev.employee.surname,
          dev.employee.salary,
          dev.selectionEnd,
          dev.employee.phone,
          dev.employee.location,
          dev.employee.career,
          dev.technologies.toString(),
          dev.currentJob,
          dev.selectionStep,
        ])
        .commit();
    });
  }
}
