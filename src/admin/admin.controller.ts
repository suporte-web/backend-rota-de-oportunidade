import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { AuthGuard } from '@/auth/auth.guard';
import { AdminService } from './admin.service';

interface UpdateSettingsDto {
  pontosExterno?: number;
  pontosInterno?: number;
  pontosGestao?: number;
  weights?: {
    externo?: number;
    interno?: number;
    gestao?: number;
  };
}

@ApiTags('Admin Rota de Oportunidade')
@Controller('admin-rdo')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({summary: 'Visualizar informações do dashboard'})
  async dashboard(@Query() query: any) {
    return this.adminService.getDashboard(query);
  }
  
  @Get('votos')
  @ApiOperation({summary: 'Visualizar votos computados'})
  async listVotes(@Query() query: any) {
    return this.adminService.listVotes(query);
  }
  
  @Get('votos/export.csv')
  @ApiOperation({summary: 'Exportar informações em CSV'})
  async exportVotesCsv(@Query() query: any, @Res() response: Response) {
    const csv = await this.adminService.generateVotesCsv(query);
    
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="relatorio-votos.csv"',
    );

    return response.send(csv);
  }
  
  @Get('votos/export.xls')
  @ApiOperation({summary: 'Exportar informações em Excel'})
  async exportVotesExcel(@Query() query: any, @Res() response: Response) {
    const excel = await this.adminService.generateVotesExcel(query);
    
    response.setHeader(
      'Content-Type',
      'application/vnd.ms-excel; charset=utf-8',
    );
    
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="elogios.xls"',
    );
    
    return response.send(excel);
  }
  
  @Get('settings')
  @ApiOperation({summary: 'Verificar informações sobre as configurações'})
  async getSettings() {
    return this.adminService.getSettings();
  }
  
  @Put('settings')
  @ApiOperation({summary: 'Atualizar as informações sobre as configurações'})
  async updateSettings(@Body() body: UpdateSettingsDto) {
    return await this.adminService.updateSettings(body);
  }
}
