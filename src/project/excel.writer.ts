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

    const devSheet = workbook.addWorksheet('Desarrolladores');
    await this.addDevs(devSheet);

    const underSelectionSheet = workbook.addWorksheet('En selección');
    await this.addUnderSelection(underSelectionSheet);

    const filePath = join(__dirname, 'excelExport.xlsx');
    await workbook.xlsx.writeFile(filePath);
    return { data: fs.readFileSync(filePath).toString('base64') };
  }

  async addPms(worksheet: Worksheet) {
    worksheet
      .addRow(['id', 'nombre', 'salario', 'fecha', 'caraceristicas'])
      .commit();
    const pms = await this.prisma.pM.findMany({ include: { employee: true } });
    pms.forEach((pm) => {
      worksheet
        .addRow([
          pm.id,
          pm.employee.name,
          pm.employee.salary,
          pm.employee.availableDate,
          pm.features.toString(),
        ])
        .commit();
    });
  }

  private async addDevs(devSheet: Worksheet) {
    devSheet
      .addRow(['id', 'nombre', 'salario', 'fecha', 'tecnologias'])
      .commit();
    const devs = await this.prisma.developer.findMany({
      include: { employee: true },
    });
    devs.forEach((dev) => {
      devSheet
        .addRow([
          dev.id,
          dev.employee.name,
          dev.employee.salary,
          dev.employee.availableDate,
          dev.technologies.toString(),
        ])
        .commit();
    });
  }

  private async addUnderSelection(underSelectionSheet: Worksheet) {
    underSelectionSheet.addRow(['id', 'nombre', 'salario', 'fecha']).commit();

    const devs = await this.prisma.underSelectionDeveloper.findMany({
      include: { employee: true },
    });
    devs.forEach((dev) => {
      underSelectionSheet
        .addRow([
          dev.id,
          dev.employee.name,
          dev.employee.salary,
          dev.selectionEnd,
        ])
        .commit();
    });
  }
}
