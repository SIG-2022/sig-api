import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Workbook, Worksheet } from 'exceljs';
import * as fs from 'fs';

@Injectable()
export class ExcelWriter {
  constructor(private prisma: PrismaService) {}

  async writeExcel() {
    const workbook = new Workbook();
    const pmSheet = workbook.addWorksheet('Pms');
    await this.addPms(pmSheet);
    const devSheet = workbook.addWorksheet('Desarrolladores');

    const underSelectionSheet = workbook.addWorksheet('En selección');
    return await workbook.xlsx.writeBuffer();
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
}
