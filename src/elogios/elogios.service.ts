import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/database/prisma/prisma.service';
import { AdminService } from '../admin/admin.service';
import { KmmService } from '@/kmm/kmm.service';

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
  cidade: string | null;
  estado: string | null;
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
  cidade: string | null;
  estado: string | null;
  dataHora?: string | Date;
  tokenAvaliador: string;
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
  cidade: string | null;
  estado: string | null;
}

@Injectable()
export class ElogiosService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly adminService: AdminService,
    private readonly kmmService: KmmService,
  ) {}

  private normalizeDate(
    value: string | Date,
  ): Date {
    if (value instanceof Date) {
      return value;
    }

    return new Date(
      `${String(value).replace(' ', 'T')}-03:00`,
    );
  }

  private normalizeCoordinate(
    value: Coordenada,
  ): number | null {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  private async getPointValue(
    type: 'interno' | 'externo',
  ): Promise<number> {
    const settings =
      await this.adminService.getSettings();

    return type === 'interno'
      ? settings.pontosInterno
      : settings.pontosExterno;
  }

  private async hasRecentPublicVote(
    carreta: string,
    token: string,
    limite: Date,
  ): Promise<boolean> {
    const vote =
      await this.prismaService.elogioMotorista.findFirst({
        where: {
          carreta,
          tokenAvaliador: token,
          dataHora: {
            gte: limite,
          },
        },
        select: {
          id: true,
        },
      });

    return Boolean(vote);
  }

  private async hasRecentInternalVote(
    matricula: string,
    token: string,
    limite: Date,
  ): Promise<boolean> {
    const vote =
      await this.prismaService.elogioInterno.findFirst({
        where: {
          matricula,
          tokenAvaliador: token,
          dataHora: {
            gte: limite,
          },
        },
        select: {
          id: true,
        },
      });

    return Boolean(vote);
  }

  async criarElogioPublico(
    data: PublicPraiseData,
    tokenAvaliador?: string,
  ) {
    const token =
      String(tokenAvaliador || '')
        .trim()
        .toLowerCase();

    const pontos =
      await this.getPointValue('externo');

    return this.prismaService.elogioMotorista.create({
      data: {
        nome: data.nome,
        nomeMotorista:
          data.nomeMotorista || null,
        carreta: data.carreta,
        telefone: data.telefone,
        elogio: data.elogio,
        tipo: 'Externo',
        pontos,

        latitude:
          this.normalizeCoordinate(
            data.latitude,
          ),

        longitude:
          this.normalizeCoordinate(
            data.longitude,
          ),

        mapsLink: data.mapsLink,

        userAgent:
          data.userAgent || null,

        cidade:
          data.cidade || null,

        estado:
          data.estado || null,

        tokenAvaliador:
          token || data.tokenAvaliador,
      },
    });
  }

  async criarOcorrencia(
    data: OccurrenceData,
  ) {
    return this.prismaService.ocorrenciaMotorista.create({
      data: {
        nome: data.nome,
        carreta: data.carreta,
        telefone: data.telefone,

        tipoOcorrencia:
          data.tipoOcorrencia,

        descricao:
          data.descricao,

        latitude:
          this.normalizeCoordinate(
            data.latitude,
          ),

        longitude:
          this.normalizeCoordinate(
            data.longitude,
          ),

        mapsLink:
          data.mapsLink,

        userAgent:
          data.userAgent || null,

        cidade:
          data.cidade || null,

        estado:
          data.estado || null,
      },
    });
  }

  async listarMotoristas(
    pesquisa = '',
    limit?: string,
  ) {
    const limitNumber =
      Number.parseInt(
        String(limit || ''),
        10,
      );

    return this.kmmService.listarMotoristasAtivos(
      pesquisa || '',
      Number.isFinite(limitNumber)
        ? limitNumber
        : undefined,
    );
  }

  async listarCarretas(
    pesquisa = '',
    limit?: string,
  ) {
    const limitNumber =
      Number.parseInt(
        String(limit || ''),
        10,
      );

    const rows =
      await this.kmmService.listarCarretasAtivas(
        pesquisa || '',
        Number.isFinite(limitNumber)
          ? limitNumber
          : undefined,
      );

    return rows.map((row) => ({
      carreta: row.carreta,
    }));
  }

  async criarElogioInterno(
    data: InternalPraiseData,
    tokenAvaliador?: string,
  ) {
    const token =
      String(tokenAvaliador || '')
        .trim()
        .toLowerCase();

    const pontos =
      await this.getPointValue('interno');

    const dataHora =
      data.dataHora
        ? this.normalizeDate(
            data.dataHora,
          )
        : new Date();

    return this.prismaService.elogioInterno.create({
      data: {
        matricula:
          data.matricula,

        elogio:
          data.elogio,

        motorista:
          data.motorista,

        telefone:
          data.telefone,

        latitude:
          this.normalizeCoordinate(
            data.latitude,
          ),

        longitude:
          this.normalizeCoordinate(
            data.longitude,
          ),

        mapsLink:
          data.mapsLink,

        cidade:
          data.cidade || null,

        estado:
          data.estado || null,

        dataHora,

        tokenAvaliador:
          token || data.tokenAvaliador,

        tipo: 'Interno',

        pontos,
      },
    });
  }
}