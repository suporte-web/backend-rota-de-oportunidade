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

  async listVotes(filters: any = {}): Promise<any[]> {
    const limit = this.normalizeLimit(filters.limit, 100);
    const offset = this.normalizeOffset(filters.offset);
    const built = this.buildWhere(filters);

    const [rows]: any = await this.mysqlService.query(
      `
        SELECT *
        FROM (${this.unionVotesSql()}) votos
        ${built.clause}
        ORDER BY data_hora DESC
        LIMIT ? OFFSET ?
      `,
      [...built.params, limit, offset],
    );

    return rows as VoteRow[];
  }

  async getDashboard(filters: any = {}) {
    const built = this.buildWhere(filters);

    const base = `
      FROM (${this.unionVotesSql()}) votos
      ${built.clause}
    `;

    const [totalsRows]: any = await this.mysqlService.query(
      `
        SELECT
          COUNT(*) AS totalVotos,
          COALESCE(SUM(pontos), 0) AS totalPontos,
          SUM(
            CASE WHEN origem = 'interno' THEN 1 ELSE 0 END
          ) AS votosInternos,
          SUM(
            CASE WHEN origem = 'externo' THEN 1 ELSE 0 END
          ) AS votosExternos
        ${base}
      `,
      built.params,
    );

    const getRanking = async (rankingFilters: any) => {
      const rankingBuilt = this.buildWhere(rankingFilters);

      const [rows]: any = await this.mysqlService.query(
        `
          SELECT
            origem,
            avaliado,
            identificador,
            COUNT(*) AS totalVotos,
            COALESCE(SUM(pontos), 0) AS totalPontos
          FROM (${this.unionVotesSql()}) votos
          ${rankingBuilt.clause}
          GROUP BY origem, avaliado, identificador
          ORDER BY
            totalPontos DESC,
            totalVotos DESC,
            avaliado ASC
          LIMIT 5
        `,
        rankingBuilt.params,
      );

      return rows;
    };

    const [rankingGeral, rankingInterno, rankingExterno] = await Promise.all([
      getRanking(filters),
      getRanking({
        ...filters,
        tipo: 'interno',
      }),
      getRanking({
        ...filters,
        tipo: 'externo',
      }),
    ]);

    const locationCondition = built.clause ? 'AND' : 'WHERE';

    const [locations]: any = await this.mysqlService.query(
      `
        SELECT
          origem,
          avaliado,
          identificador,
          latitude,
          longitude,
          cidade,
          estado,
          data_hora
        ${base}
        ${locationCondition}
          latitude IS NOT NULL
          AND longitude IS NOT NULL
        ORDER BY data_hora DESC
        LIMIT 250
      `,
      built.params,
    );

    return {
      totals: totalsRows?.[0] || {},
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
    const rows = await this.listVotes({
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
    const rows = await this.listVotes({
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
}
