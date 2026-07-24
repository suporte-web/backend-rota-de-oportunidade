import { BadRequestException, Injectable } from '@nestjs/common';
import { MysqlParam, MysqlService } from '../database/mysql/mysql.service';

const DEFAULT_SETTINGS = {
  weights: {
    interno: 2,
    gestao: 2,
    externo: 2,
  },
};

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

@Injectable()
export class AdminService {
  constructor(private readonly mysqlService: MysqlService) {}

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

  async ensureAdminTables(): Promise<void> {
    await this.mysqlService.query(`
      CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(80) NOT NULL PRIMARY KEY,
        \`value\` VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP NOT NULL
          DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP
      )
      ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
    `);

    await this.mysqlService.query(
      `
        INSERT IGNORE INTO settings (\`key\`, \`value\`)
        VALUES (?, ?)
      `,
      ['weights', JSON.stringify(DEFAULT_SETTINGS.weights)],
    );
  }

  async getSettings() {
    await this.ensureAdminTables();

    const [rows]: any = await this.mysqlService.query(
      `
        SELECT \`key\`, \`value\`
        FROM settings
        WHERE \`key\` = ?
        LIMIT 1
      `,
      ['weights'],
    );

    let weights = {
      ...DEFAULT_SETTINGS.weights,
    };

    try {
      const parsed = JSON.parse(rows?.[0]?.value || '{}');

      weights = {
        interno: Number(parsed.interno) || DEFAULT_SETTINGS.weights.interno,
        gestao: Number(parsed.gestao) || DEFAULT_SETTINGS.weights.gestao,
        externo: Number(parsed.externo) || DEFAULT_SETTINGS.weights.externo,
      };
    } catch {
      weights = {
        ...DEFAULT_SETTINGS.weights,
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
    await this.ensureAdminTables();

    const pontosExterno = Math.max(
      0,
      Math.trunc(Number(data.pontosExterno ?? data.weights?.externo)),
    );

    const pontosInterno = Math.max(
      0,
      Math.trunc(Number(data.pontosInterno ?? data.weights?.interno)),
    );

    const pontosGestao = Math.max(
      0,
      Math.trunc(
        Number(
          data.pontosGestao ??
            data.weights?.gestao ??
            DEFAULT_SETTINGS.weights.gestao,
        ),
      ),
    );

    if (
      !Number.isFinite(pontosExterno) ||
      !Number.isFinite(pontosInterno) ||
      !Number.isFinite(pontosGestao)
    ) {
      throw new BadRequestException({
        status: 'erro',
        mensagem: 'Pontuação inválida.',
      });
    }

    const weights = {
      interno: pontosInterno,
      gestao: pontosGestao,
      externo: pontosExterno,
    };

    await this.mysqlService.query(
      `
        INSERT INTO settings (\`key\`, \`value\`)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
          \`value\` = VALUES(\`value\`)
      `,
      ['weights', JSON.stringify(weights)],
    );

    return this.getSettings();
  }

  private buildWhere(filters: any = {}): {
    clause: string;
    params: MysqlParam[];
  } {
    const params: MysqlParam[] = [];
    const where: string[] = [];

    const from = this.normalizeDate(filters.from);
    const to = this.normalizeDate(filters.to, true);
    const q = String(filters.q || '').trim();

    if (from) {
      where.push('data_hora >= ?');
      params.push(from);
    }

    if (to) {
      where.push('data_hora <= ?');
      params.push(to);
    }

    if (filters.tipo === 'interno' || filters.tipo === 'externo') {
      where.push('origem = ?');
      params.push(filters.tipo);
    }

    if (q) {
      where.push(`
      (
        avaliado LIKE ?
        OR avaliador LIKE ?
        OR identificador LIKE ?
        OR cidade LIKE ?
        OR estado LIKE ?
      )
    `);

      const like = `%${q}%`;

      params.push(like, like, like, like, like);
    }

    return {
      clause: where.length ? `WHERE ${where.join(' AND ')}` : '',
      params,
    };
  }

  private unionVotesSql(): string {
    return `
      SELECT
        'externo' AS origem,
        id,
        COALESCE(NULLIF(nome_motorista, ''), carreta) AS avaliado,
        carreta AS identificador,
        nome AS avaliador,
        telefone,
        elogio AS comentario,
        pontos,
        latitude,
        longitude,
        maps_link,
        cidade,
        estado,
        data_hora
      FROM elogios_motoristas

      UNION ALL

      SELECT
        'interno' AS origem,
        id,
        motorista AS avaliado,
        matricula AS identificador,
        NULL AS avaliador,
        telefone,
        elogio AS comentario,
        pontos,
        latitude,
        longitude,
        maps_link,
        cidade,
        estado,
        data_hora
      FROM elogios_internos
    `;
  }

  async listVotes(filters: any = {}): Promise<ListVotesResponse> {
    const limit = this.normalizeLimit(filters.limit, 100);
    const offset = this.normalizeOffset(filters.offset);
    const built = this.buildWhere(filters);

    const parametrosFiltros = built.params ?? [];

    const [rowsResult, countResult]: any = await Promise.all([
      this.mysqlService.query(
        `
        SELECT *
        FROM (${this.unionVotesSql()}) votos
        ${built.clause}
        ORDER BY data_hora DESC
        LIMIT ? OFFSET ?
      `,
        [...parametrosFiltros, limit, offset],
      ),

      this.mysqlService.query(
        `
        SELECT COUNT(*) AS total
        FROM (${this.unionVotesSql()}) votos
        ${built.clause}
        `,
        parametrosFiltros,
      ),
    ]);

    // const rows = rowsResult?.[0] ?? [];
    const countRows = countResult?.[0] ?? [];

    return {
      result: rowsResult as VoteRow[],
      total: Number(countRows.total ?? 0),
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
