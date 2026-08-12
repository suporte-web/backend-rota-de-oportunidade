import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/database/prisma/prisma.service';
import { AdminService } from '../admin/admin.service';
import { KmmService } from '@/kmm/kmm.service';
import { GeoService } from '@/common/services/geo.service';

type Coordenada = string | number | null | undefined;

interface PublicPraiseData {
  nome: string;
  nomeMotorista: string | null;
  carreta: string;
  telefone: string;
  elogio: string;
  latitude: Coordenada;
  longitude: Coordenada;
  mapsLink: string | null;
  userAgent?: string;
  cidade?: string | null;
  estado?: string | null;
  tokenAvaliador: string;
}

interface InternalPraiseData {
  matricula: string;
  elogio: string;
  motorista: string;
  telefone: string;
  latitude: Coordenada;
  longitude: Coordenada;
  mapsLink: string | null;
  cidade?: string | null;
  estado?: string | null;
  dataHora?: string | Date;
  tokenAvaliador: string;
  autor?: string | null;
}

interface OccurrenceData {
  nome: string;
  carreta: string;
  telefone: string;
  tipoOcorrencia: string;
  descricao: string;
  latitude: Coordenada;
  longitude: Coordenada;
  mapsLink: string | null;
  userAgent?: string;
  cidade?: string | null;
  estado?: string | null;
}

@Injectable()
export class ElogiosService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly adminService: AdminService,
    private readonly kmmService: KmmService,
    private readonly geoService: GeoService,
  ) {}

  private normalizeDate(value: string | Date): Date {
    if (value instanceof Date) {
      return value;
    }

    return new Date(`${String(value).replace(' ', 'T')}-03:00`);
  }

  private normalizeCoordinate(value: Coordenada): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  private async getPointValue(type: 'interno' | 'externo'): Promise<number> {
    const settings = await this.adminService.getSettings();

    return type === 'interno' ? settings.pontosInterno : settings.pontosExterno;
  }

  private async resolverLocalizacao(
    latitude: Coordenada,
    longitude: Coordenada,
    cidade?: string | null,
    estado?: string | null,
  ) {
    const lat = this.normalizeCoordinate(latitude);

    const lng = this.normalizeCoordinate(longitude);

    if (cidade || estado) {
      return {
        latitude: lat,
        longitude: lng,
        cidade: cidade || null,
        estado: estado || null,
      };
    }

    if (lat === null || lng === null) {
      return {
        latitude: lat,
        longitude: lng,
        cidade: null,
        estado: null,
      };
    }

    const localizacao = await this.geoService.getCidadeEstado(lat, lng);

    return {
      latitude: lat,
      longitude: lng,
      cidade: localizacao.cidade,
      estado: localizacao.estado,
    };
  }

  async criarElogioPublico(data: PublicPraiseData, tokenAvaliador?: string) {
    const token = String(tokenAvaliador || '')
      .trim()
      .toLowerCase();

    const pontos = await this.getPointValue('externo');

    const localizacao = await this.resolverLocalizacao(
      data.latitude,
      data.longitude,
      data.cidade,
      data.estado,
    );

    return this.prismaService.elogioMotorista.create({
      data: {
        nome: data.nome,

        nomeMotorista: data.nomeMotorista || null,

        carreta: data.carreta,

        telefone: data.telefone,

        elogio: data.elogio,

        tipo: 'Externo',

        pontos,

        latitude: localizacao.latitude,

        longitude: localizacao.longitude,

        cidade: localizacao.cidade,

        estado: localizacao.estado,

        mapsLink: data.mapsLink || null,

        userAgent: data.userAgent || null,

        tokenAvaliador: token || data.tokenAvaliador,
      },
    });
  }

  async criarOcorrencia(data: OccurrenceData) {
    const localizacao = await this.resolverLocalizacao(
      data.latitude,
      data.longitude,
      data.cidade,
      data.estado,
    );

    return this.prismaService.ocorrenciaMotorista.create({
      data: {
        nome: data.nome,

        carreta: data.carreta,

        telefone: data.telefone,

        tipoOcorrencia: data.tipoOcorrencia,

        descricao: data.descricao,

        latitude: localizacao.latitude,

        longitude: localizacao.longitude,

        mapsLink: data.mapsLink || null,

        userAgent: data.userAgent || null,

        cidade: localizacao.cidade,

        estado: localizacao.estado,
      },
    });
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

  async criarElogioInterno(data: InternalPraiseData, tokenAvaliador?: string) {
    const token = String(tokenAvaliador || '')
      .trim()
      .toLowerCase();

    const pontos = await this.getPointValue('interno');

    const dataHora = data.dataHora
      ? this.normalizeDate(data.dataHora)
      : new Date();

    const localizacao = await this.resolverLocalizacao(
      data.latitude,
      data.longitude,
      data.cidade,
      data.estado,
    );

    return this.prismaService.elogioInterno.create({
      data: {
        matricula: data.matricula,

        elogio: data.elogio,

        motorista: data.motorista,

        telefone: data.telefone,

        latitude: localizacao.latitude,

        longitude: localizacao.longitude,

        mapsLink: data.mapsLink || null,

        cidade: localizacao.cidade,

        estado: localizacao.estado,

        dataHora,

        tokenAvaliador: token || data.tokenAvaliador,

        tipo: 'Interno',

        pontos,

        autor: data.autor,
      },
    });
  }
}
