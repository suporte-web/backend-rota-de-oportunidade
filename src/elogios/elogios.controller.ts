import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
} from '@nestjs/common';
import { ElogiosService } from './elogios.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Elogios')
@Controller('elogios')
export class ElogiosController {
  constructor(
    private readonly elogiosService: ElogiosService,
  ) {}

  @Post('elogio-externo')
  criarElogioPublico(
    @Headers('x-avaliador-token')
    tokenAvaliador: string | undefined,
    @Body() data: any,
  ) {
    return this.elogiosService.criarElogioPublico(
      data,
      tokenAvaliador,
    );
  }

  @Post('ocorrencia')
  criarOcorrencia(
    @Body() data: any,
  ) {
    return this.elogiosService.criarOcorrencia(data);
  }

  @Get('motoristas-ativos')
  listarMotoristas(
    @Query('q') pesquisa?: string,
    @Query('limit') limit?: string,
  ) {
    return this.elogiosService.listarMotoristas(
      pesquisa,
      limit,
    );
  }

  @Get('carretas-ativas')
  listarCarretas(
    @Query('q') pesquisa?: string,
    @Query('limit') limit?: string,
  ) {
    return this.elogiosService.listarCarretas(
      pesquisa,
      limit,
    );
  }

  @Post('elogio-interno')
  criarElogioInterno(
    @Headers('x-avaliador-token')
    tokenAvaliador: string | undefined,
    @Body() data: any,
  ) {
    return this.elogiosService.criarElogioInterno(
      data,
      tokenAvaliador,
    );
  }
}