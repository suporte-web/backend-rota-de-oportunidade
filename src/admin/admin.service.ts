import { PrismaService } from '@/database/prisma/prisma.service';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

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

interface VoteRow {
  origem: 'interno' | 'externo';
  id: number | string;
  avaliado: string | null;
  identificador: string | null;
  avaliador: string | null;
  telefone: string | null;
  comentario: string | null;
  pontos: number;
  latitude: number | string | null;
  longitude: number | string | null;
  maps_link?: string | null;
  cidade: string | null;
  estado: string | null;
  data_hora: Date | string;
}

export type ListVotesResponse = {
  result: VoteRow[];
  total: number;
  limit: number;
  offset: number;
};

const defaultWeights = {
  interno: 0,
  gestao: 0,
  externo: 0,
};

@Injectable()
export class AdminService {
  constructor(private readonly prismaService: PrismaService) {}

  private normalizeDate(value?: unknown, endOfDay = false): string | null {
    if (!value) {
      return null;
    }

    const date = String(value).slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return null;
    }

    return `${date} ${endOfDay ? '23:59:59' : '00:00:00'}`;
  }

  private normalizeLimit(value: unknown, defaultValue = 100): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return defaultValue;
    }

    return Math.min(Math.max(Math.trunc(parsed), 1), 1000);
  }

  private normalizeOffset(value: unknown): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.max(Math.trunc(parsed), 0);
  }

  async ensureDefaultSettings(): Promise<void> {
    await this.prismaService.settings.upsert({
      where: {
        key: 'weights',
      },
      update: {},
      create: {
        key: 'weights',
        value: defaultWeights,
      },
    });
  }

  async getSettings() {
    await this.ensureDefaultSettings();

    const row = await this.prismaService.settings.findUnique({
      where: {
        key: 'weights',
      },
    });

    let weights = { ...defaultWeights };

    try {
      const value = row?.value;

      const parsed =
        value && typeof value === 'object'
          ? (value as Record<string, unknown>)
          : {};

      const interno = Number(parsed.interno);
      const gestao = Number(parsed.gestao);
      const externo = Number(parsed.externo);

      weights = {
        interno: Number.isFinite(interno) ? interno : defaultWeights.interno,

        gestao: Number.isFinite(gestao) ? gestao : defaultWeights.gestao,

        externo: Number.isFinite(externo) ? externo : defaultWeights.externo,
      };
    } catch (error) {
      Logger.error(
        'Erro ao interpretar as configurações de pontuação',
        error instanceof Error ? error.stack : String(error),
      );

      weights = {
        ...defaultWeights,
      };
    }

    return {
      weights,
      pontosExterno: weights.externo,
      pontosInterno: weights.interno,
      pontosGestao: weights.gestao,
    };
  }

  async updateSettings(data: UpdateSettingsDto) {
    await this.ensureDefaultSettings();

    const settingsAtuais = await this.getSettings();

    const externoRecebido =
      data.pontosExterno ??
      data.weights?.externo ??
      settingsAtuais.weights.externo;

    const internoRecebido =
      data.pontosInterno ??
      data.weights?.interno ??
      settingsAtuais.weights.interno;

    const gestaoRecebido =
      data.pontosGestao ??
      data.weights?.gestao ??
      settingsAtuais.weights.gestao;

    const externo = Number(externoRecebido);
    const interno = Number(internoRecebido);
    const gestao = Number(gestaoRecebido);

    if (
      !Number.isFinite(externo) ||
      !Number.isFinite(interno) ||
      !Number.isFinite(gestao)
    ) {
      throw new BadRequestException(
        'Todas as pontuações devem ser números válidos.',
      );
    }

    if (externo < 0 || interno < 0 || gestao < 0) {
      throw new BadRequestException('As pontuações não podem ser negativas.');
    }

    const weights = {
      interno: Math.trunc(interno),
      gestao: Math.trunc(gestao),
      externo: Math.trunc(externo),
    };

    await this.prismaService.settings.upsert({
      where: {
        key: 'weights',
      },
      update: {
        value: weights,
      },
      create: {
        key: 'weights',
        value: weights,
      },
    });

    Logger.log(
      `Configurações atualizadas: ${JSON.stringify(weights)}`,
      AdminService.name,
    );

    return {
      weights,
      pontosExterno: weights.externo,
      pontosInterno: weights.interno,
      pontosGestao: weights.gestao,
    };
  }

  async listVotes(filters: any = {}): Promise<ListVotesResponse> {
    const limit = this.normalizeLimit(filters.limit, 100);
    const offset = this.normalizeOffset(filters.offset);

    const from = this.normalizeDate(filters.from);
    const to = this.normalizeDate(filters.to, true);
    const q = String(filters.q || '').trim();

    const dateFilter =
      from || to
        ? {
            dataHora: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {};

    const buscarInternos = !filters.tipo || filters.tipo === 'interno';

    const buscarExternos = !filters.tipo || filters.tipo === 'externo';

    const [internos, externos] = await Promise.all([
      buscarInternos
        ? this.prismaService.elogioInterno.findMany({
            where: {
              ...dateFilter,

              ...(q
                ? {
                    OR: [
                      {
                        motorista: {
                          contains: q,
                          mode: 'insensitive',
                        },
                      },
                      {
                        matricula: {
                          contains: q,
                          mode: 'insensitive',
                        },
                      },
                      {
                        cidade: {
                          contains: q,
                          mode: 'insensitive',
                        },
                      },
                      {
                        estado: {
                          contains: q,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  }
                : {}),
            },
          })
        : Promise.resolve([]),

      buscarExternos
        ? this.prismaService.elogioMotorista.findMany({
            where: {
              ...dateFilter,

              ...(q
                ? {
                    OR: [
                      {
                        nomeMotorista: {
                          contains: q,
                          mode: 'insensitive',
                        },
                      },
                      {
                        nome: {
                          contains: q,
                          mode: 'insensitive',
                        },
                      },
                      {
                        carreta: {
                          contains: q,
                          mode: 'insensitive',
                        },
                      },
                      {
                        cidade: {
                          contains: q,
                          mode: 'insensitive',
                        },
                      },
                      {
                        estado: {
                          contains: q,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  }
                : {}),
            },
          })
        : Promise.resolve([]),
    ]);

    const votosInternos = internos.map<VoteRow>((item) => ({
      origem: 'interno' as const,
      id: item.id,
      avaliado: item.motorista,
      identificador: item.matricula,
      avaliador: null,
      telefone: item.telefone,
      comentario: item.elogio,
      pontos: item.pontos,
      latitude: item.latitude,
      longitude: item.longitude,
      maps_link: item.mapsLink,
      cidade: item.cidade,
      estado: item.estado,
      data_hora: item.dataHora,
    }));

    const votosExternos = externos.map<VoteRow>((item) => ({
      origem: 'externo' as const,
      id: item.id,

      avaliado: item.nomeMotorista?.trim() || item.carreta,

      identificador: item.carreta,
      avaliador: item.nome,
      telefone: item.telefone,
      comentario: item.elogio,
      pontos: item.pontos,
      latitude: item.latitude,
      longitude: item.longitude,
      maps_link: item.mapsLink,
      cidade: item.cidade,
      estado: item.estado,
      data_hora: item.dataHora,
    }));

    const todos: VoteRow[] = [...votosInternos, ...votosExternos].sort(
      (a, b) =>
        new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime(),
    );

    const total = todos.length;

    const result = todos.slice(offset, offset + limit);

    return {
      result,
      total,
      limit,
      offset,
    };
  }

  async getDashboard(filters: any = {}) {
    const votos = await this.findAllVotesForDashboard(filters);

    const totalVotos = votos.length;

    const totalPontos = votos.reduce(
      (total, voto) => total + Number(voto.pontos || 0),
      0,
    );

    const votosInternos = votos.filter(
      (voto) => voto.origem === 'interno',
    ).length;

    const votosExternos = votos.filter(
      (voto) => voto.origem === 'externo',
    ).length;

    const rankingGeral = this.buildRanking(votos);

    const rankingInterno = this.buildRanking(
      votos.filter((voto) => voto.origem === 'interno'),
    );

    const rankingExterno = this.buildRanking(
      votos.filter((voto) => voto.origem === 'externo'),
    );

    const locations = votos
      .filter((voto) => {
        const latitude = Number(voto.latitude);
        const longitude = Number(voto.longitude);

        return (
          voto.latitude !== null &&
          voto.latitude !== undefined &&
          voto.longitude !== null &&
          voto.longitude !== undefined &&
          Number.isFinite(latitude) &&
          Number.isFinite(longitude)
        );
      })
      .sort((a, b) => {
        const dataA = new Date(a.data_hora).getTime();
        const dataB = new Date(b.data_hora).getTime();

        return dataB - dataA;
      })
      .slice(0, 250)
      .map((voto) => ({
        origem: voto.origem,
        avaliado: voto.avaliado,
        identificador: voto.identificador,
        latitude: voto.latitude,
        longitude: voto.longitude,
        maps_link: voto.maps_link ?? null,
        cidade: voto.cidade,
        estado: voto.estado,
        data_hora: voto.data_hora,
      }));

    return {
      totals: {
        totalVotos,
        totalPontos,
        votosInternos,
        votosExternos,
      },

      ranking: rankingGeral,

      rankings: {
        geral: rankingGeral,
        interno: rankingInterno,
        externo: rankingExterno,
      },

      locations,
    };
  }

  private escapeCsv(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    const text = String(value).replace(/\r?\n/g, ' ');

    return `"${text.replace(/"/g, '""')}"`;
  }

  private escapeHtml(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async generateVotesCsv(filters: any = {}): Promise<string> {
    const { result: rows } = await this.listVotes({
      ...filters,
      limit: 1000,
      offset: 0,
    });

    const headers: Array<keyof VoteRow> = [
      'origem',
      'id',
      'avaliado',
      'identificador',
      'avaliador',
      'telefone',
      'comentario',
      'pontos',
      'latitude',
      'longitude',
      'cidade',
      'estado',
      'data_hora',
    ];

    const csv = [
      headers.join(';'),
      ...rows.map((row) =>
        headers.map((header) => this.escapeCsv(row[header])).join(';'),
      ),
    ].join('\r\n');

    return `\uFEFF${csv}`;
  }

  async generateVotesExcel(filters: any = {}): Promise<string> {
    const { result: rows } = await this.listVotes({
      ...filters,
      limit: 1000,
      offset: 0,
    });

    return `\uFEFF<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">

          <style>
            table {
              width: 100%;
              border-collapse: collapse;
            }

            th,
            td {
              border: 1px solid #999;
              padding: 6px;
              text-align: left;
            }

            th {
              background: #f2f2f2;
              font-weight: bold;
            }
          </style>
        </head>

        <body>
          <table>
            <thead>
              <tr>
                <th>Motorista</th>
                <th>Cidade</th>
                <th>Estado</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Data</th>
                <th>Pontos</th>
              </tr>
            </thead>

            <tbody>
              ${rows
                .map(
                  (row) => `
                    <tr>
                      <td>${this.escapeHtml(row.avaliado)}</td>
                      <td>${this.escapeHtml(row.cidade)}</td>
                      <td>${this.escapeHtml(row.estado)}</td>
                      <td>${this.escapeHtml(row.comentario)}</td>
                      <td>${this.escapeHtml(row.origem)}</td>
                      <td>${this.escapeHtml(row.data_hora)}</td>
                      <td>${this.escapeHtml(row.pontos)}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </body>
      </html>`;
  }

  private async findAllVotesForDashboard(
    filters: any = {},
  ): Promise<VoteRow[]> {
    const limit = 1000;
    let offset = 0;
    let total = 0;

    const votos: VoteRow[] = [];

    do {
      const response = await this.listVotes({
        ...filters,
        limit,
        offset,
      });

      const result = Array.isArray(response.result) ? response.result : [];

      votos.push(...result);

      total = Number(response.total || 0);
      offset += limit;
    } while (votos.length < total);

    return votos;
  }

  private buildRanking(votos: VoteRow[]) {
    const agrupados = new Map<
      string,
      {
        origem: 'interno' | 'externo';
        avaliado: string | null;
        identificador: string | null;
        totalVotos: number;
        totalPontos: number;
      }
    >();

    for (const voto of votos) {
      const origem = voto.origem;
      const avaliado = voto.avaliado?.trim() || null;
      const identificador = voto.identificador?.trim() || null;

      const chave = [
        origem,
        avaliado?.toLowerCase() || '',
        identificador?.toLowerCase() || '',
      ].join('|');

      const existente = agrupados.get(chave);

      if (existente) {
        existente.totalVotos += 1;
        existente.totalPontos += Number(voto.pontos || 0);

        continue;
      }

      agrupados.set(chave, {
        origem,
        avaliado,
        identificador,
        totalVotos: 1,
        totalPontos: Number(voto.pontos || 0),
      });
    }

    return Array.from(agrupados.values())
      .sort((a, b) => {
        if (b.totalPontos !== a.totalPontos) {
          return b.totalPontos - a.totalPontos;
        }

        if (b.totalVotos !== a.totalVotos) {
          return b.totalVotos - a.totalVotos;
        }

        return String(a.avaliado || '').localeCompare(
          String(b.avaliado || ''),
          'pt-BR',
        );
      })
      .slice(0, 5);
  }
}
