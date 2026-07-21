import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GeoService } from '../common/services/geo.service';
import { TextService } from '../common/services/text.service';
import { ElogiosRepository } from './elogios.repository';
import { KmmService } from '@/kmm/kmm.service';

@Injectable()
export class ElogiosService {
  private readonly logger = new Logger(ElogiosService.name);

  constructor(
    private readonly elogiosRepository: ElogiosRepository,
    private readonly geoService: GeoService,
    private readonly kmmService: KmmService,
    private readonly textService: TextService,
  ) {}

  private hasLocation(latitude: unknown, longitude: unknown): boolean {
    return (
      latitude !== undefined &&
      latitude !== null &&
      latitude !== '' &&
      longitude !== undefined &&
      longitude !== null &&
      longitude !== ''
    );
  }

  private buildMapsLink(
    latitude: unknown,
    longitude: unknown,
    mapsLink?: string,
  ): string | null {
    if (mapsLink) {
      return mapsLink;
    }

    if (!this.hasLocation(latitude, longitude)) {
      return null;
    }

    return `https://maps.google.com/?q=${latitude},${longitude}`;
  }

  private normalizeToken(token?: string): string {
    return String(token || '')
      .trim()
      .toLowerCase();
  }

  private getSevenDaysAgo(): Date {
    const date = new Date();

    date.setDate(date.getDate() - 7);

    return date;
  }

  async criarElogioPublico(data: any, tokenHeader?: string) {
    const tokenAvaliador = this.normalizeToken(tokenHeader);

    if (!tokenAvaliador) {
      throw new BadRequestException('Token do avaliador nao informado.');
    }

    if (!data.nome || !data.carreta || !data.telefone || !data.elogio) {
      throw new BadRequestException('Campos obrigatorios nao preenchidos.');
    }

    if (!this.hasLocation(data.latitude, data.longitude)) {
      throw new BadRequestException(
        'Localizacao obrigatoria. Permita o acesso a localizacao do celular para enviar.',
      );
    }

    const carreta = this.textService.normalizaCarreta(data.carreta);

    const existeCarreta =
      await this.kmmService.existeCarretaAtivaNoKMM(carreta);

    if (!existeCarreta) {
      throw new NotFoundException('Carreta nao encontrada ou inativa.');
    }

    let nomeMotorista = data.nome_motorista?.trim() || null;

    if (!nomeMotorista) {
      nomeMotorista = await this.kmmService.getMotoristaPorCarreta(carreta);
    }

    const existeElogio = await this.elogiosRepository.hasRecentPublicVote(
      carreta,
      tokenAvaliador,
      this.getSevenDaysAgo(),
    );

    if (existeElogio) {
      throw new ConflictException(
        'Voce ja elogiou esta carreta nos ultimos 7 dias.',
      );
    }

    const localizacao = await this.geoService.getCidadeEstado(
      data.latitude,
      data.longitude,
    );

    const result = await this.elogiosRepository.createPublicPraise({
      nome: data.nome.trim(),
      nomeMotorista,
      carreta,
      telefone: data.telefone.trim(),
      elogio: data.elogio.trim(),
      latitude: data.latitude,
      longitude: data.longitude,
      mapsLink: this.buildMapsLink(
        data.latitude,
        data.longitude,
        data.maps_link,
      ),
      userAgent: data.user_agent,
      cidade: localizacao.cidade,
      estado: localizacao.estado,
      tokenAvaliador,
    });

    return {
      status: 'sucesso',
      mensagem: 'Elogio salvo com sucesso!',
      id: result.insertId,
    };
  }

  async criarOcorrencia(data: any) {
    if (
      !data.nome ||
      !data.carreta ||
      !data.telefone ||
      !data.tipo_ocorrencia ||
      !data.descricao
    ) {
      throw new BadRequestException('Campos obrigatorios nao preenchidos.');
    }

    if (!this.hasLocation(data.latitude, data.longitude)) {
      throw new BadRequestException(
        'Localizacao obrigatoria. Permita o acesso a localizacao do celular para enviar.',
      );
    }

    const carreta = this.textService.normalizaCarreta(data.carreta);

    const existeCarreta =
      await this.kmmService.existeCarretaAtivaNoKMM(carreta);

    if (!existeCarreta) {
      throw new NotFoundException('Placa nao encontrada no KMM.');
    }

    const localizacao = await this.geoService.getCidadeEstado(
      data.latitude,
      data.longitude,
    );

    const result = await this.elogiosRepository.createOccurrence({
      nome: data.nome.trim(),
      carreta,
      telefone: data.telefone.trim(),
      tipoOcorrencia: data.tipo_ocorrencia.trim(),
      descricao: data.descricao.trim(),
      latitude: data.latitude,
      longitude: data.longitude,
      mapsLink: this.buildMapsLink(
        data.latitude,
        data.longitude,
        data.maps_link,
      ),
      userAgent: data.user_agent,
      cidade: localizacao.cidade,
      estado: localizacao.estado,
    });

    return {
      status: 'sucesso',
      mensagem: 'Ocorrencia salva!',
      id: result.insertId,
    };
  }

  async listarMotoristas(pesquisa = '', limit?: string) {
    const limitNumber = Number.parseInt(String(limit || ''), 10);
    
    return this.kmmService.listarMotoristasAtivos(
      pesquisa || '',
      Number.isFinite(limitNumber) ? limitNumber : undefined,
    );
  }

  async listarCarretas(pesquisa = '', limit?: string) {
    const limitNumber = Number.parseInt(String(limit || ''), 10);

    const rows = await this.kmmService.listarCarretasAtivas(
      pesquisa || '',
      Number.isFinite(limitNumber) ? limitNumber : undefined,
    );

    return rows.map((row) => ({
      carreta: row.carreta,
    }));
  }

  async criarElogioInterno(data: any, tokenHeader?: string) {
    const tokenAvaliador = this.normalizeToken(tokenHeader);

    if (!tokenAvaliador) {
      throw new BadRequestException('Token do avaliador nao informado.');
    }

    if (!data.matricula || !data.elogio || !data.autor || !data.telefone) {
      throw new BadRequestException('Todos os campos sao obrigatorios.');
    }

    if (!this.hasLocation(data.latitude, data.longitude)) {
      throw new BadRequestException(
        'Localizacao obrigatoria. Permita o acesso a localizacao do celular para enviar.',
      );
    }

    const matricula = this.textService.onlyDigits(data.matricula);

    if (!matricula) {
      throw new BadRequestException('Matricula invalida.');
    }

    const telefone = this.textService.onlyDigits(data.telefone);

    if (!/^\d{10,11}$/.test(telefone)) {
      throw new BadRequestException(
        'Telefone invalido. Use apenas numeros com DDD (10 ou 11 digitos).',
      );
    }

    const existeElogio = await this.elogiosRepository.hasRecentInternalVote(
      matricula,
      tokenAvaliador,
      this.getSevenDaysAgo(),
    );

    if (existeElogio) {
      throw new BadRequestException(
        'Voce ja enviou um elogio para este motorista nos ultimos 7 dias.',
      );
    }

    let motorista: string | null = null;

    try {
      motorista = await this.kmmService.getNomeMotoristaPorMatricula(matricula);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';

      this.logger.warn(
        `[KMM] indisponivel na busca por matricula: ${message}. Matricula: ${matricula}`,
      );

      throw new ServiceUnavailableException({
        status: 'erro',
        mensagem:
          'Nao foi possivel validar a matricula no KMM. Tente novamente.',
      });
    }

    if (!motorista) {
      throw new NotFoundException({
        status: 'erro',
        mensagem: 'Matricula nao encontrada como motorista ativo no KMM.',
      });
    }

    const localizacao = await this.geoService.getCidadeEstado(
      data.latitude,
      data.longitude,
    );

    const result = await this.elogiosRepository.createInternalPraise({
      matricula,
      elogio: data.elogio.trim(),
      motorista,
      telefone,
      latitude: data.latitude,
      longitude: data.longitude,
      mapsLink: this.buildMapsLink(
        data.latitude,
        data.longitude,
        data.maps_link,
      ),
      cidade: localizacao.cidade,
      estado: localizacao.estado,
      dataHora: this.textService.getDataAtual(),
      tokenAvaliador,
    });

    const id = result.insertId;

    this.logger.log(
      `[Elogio interno] inserido. ID: ${id}. Matricula: ${matricula}`,
    );

    return id;
  }
}
