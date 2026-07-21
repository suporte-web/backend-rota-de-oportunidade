import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';
import { AdminService } from '../admin/admin.service';
import { MysqlService } from '../database/mysql/mysql.service';
// import { PrismaService } from '../database/prisma/prisma.service';

type Coordenada = string | number | null | undefined;

interface ExistsRow extends RowDataPacket {
  existe: number;
}

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
export class ElogiosRepository {
  constructor(
    private readonly configService: ConfigService,
    // private readonly prismaService: PrismaService,
    private readonly mysqlService: MysqlService,
    private readonly adminService: AdminService,
  ) {}

  private usingPrisma(): boolean {
    return (
      this.configService
        .get<string>('APP_DATABASE_PROVIDER')
        ?.toLowerCase() === 'prisma'
    );
  }

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

  async hasRecentPublicVote(
    carreta: string,
    token: string,
    limite: Date,
  ): Promise<boolean> {
    // if (this.usingPrisma()) {
    //   const vote =
    //     await this.prismaService.elogioMotorista.findFirst(
    //       {
    //         where: {
    //           carreta,
    //           tokenAvaliador: token,
    //           dataHora: {
    //             gte: limite,
    //           },
    //         },
    //         select: {
    //           id: true,
    //         },
    //       },
    //     );

    //   return Boolean(vote);
    // }

    const rows =
      await this.mysqlService.query<
        ExistsRow[]
      >(
        `
          SELECT 1 AS existe
          FROM elogios_motoristas
          WHERE carreta = ?
            AND token_avaliador = ?
            AND data_hora >= ?
          LIMIT 1
        `,
        [
          carreta,
          token,
          limite,
        ],
      );

    return rows.length > 0;
  }

  async createPublicPraise(
    data: PublicPraiseData,
  ) {
    const pontos =
      await this.getPointValue('externo');

    // if (this.usingPrisma()) {
    //   return this.prismaService.elogioMotorista.create(
    //     {
    //       data: {
    //         nome: data.nome,
    //         nomeMotorista:
    //           data.nomeMotorista || null,
    //         carreta: data.carreta,
    //         telefone: data.telefone,
    //         elogio: data.elogio,
    //         tipo: 'Externo',
    //         pontos,
    //         latitude:
    //           this.normalizeCoordinate(
    //             data.latitude,
    //           ),
    //         longitude:
    //           this.normalizeCoordinate(
    //             data.longitude,
    //           ),
    //         mapsLink: data.mapsLink,
    //         userAgent:
    //           data.userAgent || null,
    //         cidade: data.cidade || null,
    //         estado: data.estado || null,
    //         tokenAvaliador:
    //           data.tokenAvaliador,
    //       },
    //     },
    //   );
    // }

    return this.mysqlService.execute(
      `
        INSERT INTO elogios_motoristas (
          nome,
          nome_motorista,
          carreta,
          telefone,
          elogio,
          tipo,
          pontos,
          latitude,
          longitude,
          maps_link,
          user_agent,
          cidade,
          estado,
          token_avaliador
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.nome,
        data.nomeMotorista || null,
        data.carreta,
        data.telefone,
        data.elogio,
        'Externo',
        pontos,
        this.normalizeCoordinate(
          data.latitude,
        ),
        this.normalizeCoordinate(
          data.longitude,
        ),
        data.mapsLink,
        data.userAgent || null,
        data.cidade || null,
        data.estado || null,
        data.tokenAvaliador,
      ],
    );
  }

  async hasRecentInternalVote(
    matricula: string,
    token: string,
    limite: Date,
  ): Promise<boolean> {
    // if (this.usingPrisma()) {
    //   const vote =
    //     await this.prismaService.elogioInterno.findFirst(
    //       {
    //         where: {
    //           matricula,
    //           tokenAvaliador: token,
    //           dataHora: {
    //             gte: limite,
    //           },
    //         },
    //         select: {
    //           id: true,
    //         },
    //       },
    //     );

    //   return Boolean(vote);
    // }

    const rows =
      await this.mysqlService.query<
        ExistsRow[]
      >(
        `
          SELECT 1 AS existe
          FROM elogios_internos
          WHERE matricula = ?
            AND token_avaliador = ?
            AND data_hora >= ?
          LIMIT 1
        `,
        [
          matricula,
          token,
          limite,
        ],
      );

    return rows.length > 0;
  }

  async createInternalPraise(
    data: InternalPraiseData,
  ) {
    const pontos =
      await this.getPointValue('interno');

    const dataHora = data.dataHora
      ? this.normalizeDate(data.dataHora)
      : new Date();

    // if (this.usingPrisma()) {
    //   return this.prismaService.elogioInterno.create(
    //     {
    //       data: {
    //         matricula: data.matricula,
    //         elogio: data.elogio,
    //         motorista: data.motorista,
    //         telefone: data.telefone,
    //         latitude:
    //           this.normalizeCoordinate(
    //             data.latitude,
    //           ),
    //         longitude:
    //           this.normalizeCoordinate(
    //             data.longitude,
    //           ),
    //         mapsLink: data.mapsLink,
    //         cidade: data.cidade || null,
    //         estado: data.estado || null,
    //         dataHora,
    //         tokenAvaliador:
    //           data.tokenAvaliador,
    //         tipo: 'Interno',
    //         pontos,
    //       },
    //     },
    //   );
    // }

    return this.mysqlService.execute(
      `
        INSERT INTO elogios_internos (
          matricula,
          elogio,
          motorista,
          telefone,
          latitude,
          longitude,
          maps_link,
          cidade,
          estado,
          data_hora,
          token_avaliador,
          tipo,
          pontos
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.matricula,
        data.elogio,
        data.motorista,
        data.telefone,
        this.normalizeCoordinate(
          data.latitude,
        ),
        this.normalizeCoordinate(
          data.longitude,
        ),
        data.mapsLink,
        data.cidade || null,
        data.estado || null,
        dataHora,
        data.tokenAvaliador,
        'Interno',
        pontos,
      ],
    );
  }

  async createOccurrence(
    data: OccurrenceData,
  ) {
    // if (this.usingPrisma()) {
    //   return this.prismaService.ocorrenciaMotorista.create(
    //     {
    //       data: {
    //         nome: data.nome,
    //         carreta: data.carreta,
    //         telefone: data.telefone,
    //         tipoOcorrencia:
    //           data.tipoOcorrencia,
    //         descricao: data.descricao,
    //         latitude:
    //           this.normalizeCoordinate(
    //             data.latitude,
    //           ),
    //         longitude:
    //           this.normalizeCoordinate(
    //             data.longitude,
    //           ),
    //         mapsLink: data.mapsLink,
    //         userAgent:
    //           data.userAgent || null,
    //         cidade: data.cidade || null,
    //         estado: data.estado || null,
    //       },
    //     },
    //   );
    // }

    return this.mysqlService.execute(
      `
        INSERT INTO ocorrencias_motoristas (
          nome,
          carreta,
          telefone,
          tipo_ocorrencia,
          descricao,
          latitude,
          longitude,
          maps_link,
          user_agent,
          cidade,
          estado
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.nome,
        data.carreta,
        data.telefone,
        data.tipoOcorrencia,
        data.descricao,
        this.normalizeCoordinate(
          data.latitude,
        ),
        this.normalizeCoordinate(
          data.longitude,
        ),
        data.mapsLink,
        data.userAgent || null,
        data.cidade || null,
        data.estado || null,
      ],
    );
  }
}