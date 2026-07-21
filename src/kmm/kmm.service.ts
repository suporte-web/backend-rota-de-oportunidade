import { KmmDatabaseService } from '@/database/kmm/kmm-database.service';
import { TextService } from '@/common/services/text.service';
import { Injectable, Logger } from '@nestjs/common';
import { QueryResultRow } from 'pg';

const PLACA_RE = /^([A-Z]{3}[0-9]{4}|[A-Z]{3}[0-9][A-Z0-9][0-9]{2})$/;

interface ExisteRow extends QueryResultRow {
  existe: number;
}

interface MotoristaCarretaRow extends QueryResultRow {
  motorista: string | null;
}

export interface MotoristaAtivoRow extends QueryResultRow {
  matricula: string | number;
  nome_motorista: string;
}

export interface CarretaAtivaRow extends QueryResultRow {
  carreta: string;
}

interface MotoristaMatriculaRow extends QueryResultRow {
  nome_motorista: string | null;
}

@Injectable()
export class KmmService {
  private readonly logger = new Logger(KmmService.name);

  constructor(
    private readonly kmmDatabaseService: KmmDatabaseService,
    private readonly textService: TextService,
  ) {}

  private parecePlaca(value: unknown): boolean {
    const placa = this.textService.normalizaCarreta(value);

    return PLACA_RE.test(placa);
  }

  async existeCarretaAtivaNoKMM(carreta: string): Promise<boolean> {
    const carretaNormalizada = this.textService.normalizaCarreta(carreta);

    if (!carretaNormalizada) {
      return false;
    }

    const sql = `
      SELECT 1 AS existe
      FROM veiculo.veiculo_modalidade vm
      WHERE lower(vm."MODALIDADE"::text) = 'frota'
        AND vm."DATA_CANCELAMENTO" IS NULL
        AND vm."PLACA" IS NOT NULL
        AND regexp_replace(
          upper(vm."PLACA"::text),
          '[^A-Z0-9]',
          '',
          'g'
        ) = regexp_replace(
          upper($1),
          '[^A-Z0-9]',
          '',
          'g'
        )
      LIMIT 1
    `;

    const result = await this.kmmDatabaseService.query<ExisteRow>(sql, [
      carretaNormalizada,
    ]);

    return result.rows.length > 0;
  }

  async getMotoristaPorCarreta(carreta: string): Promise<string | null> {
    const carretaNormalizada = this.textService.normalizaCarreta(carreta);

    if (!carretaNormalizada) {
      return null;
    }

    const sql = `
      SELECT
        fd."NOME" AS motorista
      FROM veiculo.veiculo_motorista vm
      INNER JOIN folha.funcionario_dados fd
        ON fd."COD_PESSOA" = vm."COD_PESSOA"
      WHERE fd."DATA_DEMISSAO" IS NULL
        AND regexp_replace(
          upper(vm."PLACA"::text),
          '[^A-Z0-9]',
          '',
          'g'
        ) = regexp_replace(
          upper($1),
          '[^A-Z0-9]',
          '',
          'g'
        )
      ORDER BY
        vm."DATA_INICIO" DESC NULLS LAST
      LIMIT 1
    `;

    const result = await this.kmmDatabaseService.query<MotoristaCarretaRow>(
      sql,
      [carretaNormalizada],
    );

    return result.rows[0]?.motorista ?? null;
  }

  async listarMotoristasAtivos(
    pesquisa = '',
    limit?: number,
  ): Promise<MotoristaAtivoRow[]> {
    const matricula = this.textService.onlyDigits(pesquisa);

    const parsedLimit = Number(limit);

    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 50)
      : 20;

    const params: Array<string | number> = matricula
      ? [matricula, safeLimit]
      : [safeLimit];

    const whereMatricula = matricula
      ? `
        AND regexp_replace(
          COALESCE(fd."MATRICULA"::text, ''),
          '[^0-9]',
          '',
          'g'
        ) LIKE $1 || '%'
      `
      : '';

    const orderBy = matricula
      ? `
        ORDER BY
          CASE
            WHEN regexp_replace(
              COALESCE(fd."MATRICULA"::text, ''),
              '[^0-9]',
              '',
              'g'
            ) = $1
            THEN 0
            ELSE 1
          END,
          fd."NOME" ASC
      `
      : `
        ORDER BY fd."NOME" ASC
      `;

    const limitPosition = matricula ? 2 : 1;

    const sql = `
    SELECT
      fd."MATRICULA" AS matricula,
      fd."NOME" AS nome_motorista
    FROM folha.funcionario_dados fd
    WHERE fd."DATA_ADMISSAO" IS NOT NULL
      AND fd."DATA_DEMISSAO" IS NULL
      AND fd."MATRICULA" IS NOT NULL
      AND fd."NOME" IS NOT NULL
      AND trim(COALESCE(fd."CARGO", '')) ILIKE '%MOTORISTA%'
      ${whereMatricula}
    ${orderBy}
    LIMIT $${limitPosition}
  `;

    try {

      const result = await this.kmmDatabaseService.query<MotoristaAtivoRow>(
        sql,
        params,
      );

      return result.rows;
    } catch (error) {
      this.logger.error(
        '[KMM] Erro ao consultar motoristas ativos',
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  async listarCarretasAtivas(
    pesquisa = '',
    limit?: number,
  ): Promise<CarretaAtivaRow[]> {
    const query = this.textService.normalizaCarreta(pesquisa);

    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.trunc(limit as number), 1), 50)
      : 20;

    const placaNormalizadaSql = `
      regexp_replace(
        upper(vm."PLACA"::text),
        '[^A-Z0-9]',
        '',
        'g'
      )
    `;

    const whereBusca = query
      ? `
          AND ${placaNormalizadaSql}
            LIKE regexp_replace(
              upper($1),
              '[^A-Z0-9]',
              '',
              'g'
            ) || '%'
        `
      : '';

    const params: Array<string | number> = query
      ? [query, safeLimit]
      : [safeLimit];

    const limitPosition = query ? 2 : 1;

    const sql = `
      SELECT DISTINCT
        ${placaNormalizadaSql} AS carreta
      FROM veiculo.veiculo_modalidade vm
      WHERE lower(vm."MODALIDADE"::text) = 'frota'
        AND vm."DATA_CANCELAMENTO" IS NULL
        AND vm."PLACA" IS NOT NULL
        ${whereBusca}
      ORDER BY carreta
      LIMIT $${limitPosition}
    `;

    const result = await this.kmmDatabaseService.query<CarretaAtivaRow>(
      sql,
      params,
    );

    const carretas = result.rows.filter((row) => this.parecePlaca(row.carreta));

    return carretas;
  }

  async getNomeMotoristaPorMatricula(
    matricula: string,
  ): Promise<string | null> {
    const matriculaNormalizada = this.textService.onlyDigits(matricula);

    if (!matriculaNormalizada) {
      return null;
    }

    const sql = `
      SELECT
        fd."NOME" AS nome_motorista
      FROM folha.funcionario_dados fd
      WHERE fd."DATA_ADMISSAO" IS NOT NULL
        AND fd."DATA_DEMISSAO" IS NULL
        AND fd."CARGO" ILIKE ANY (
          ARRAY[
            'MOTORISTA',
            'MOTORISTA CARRETEIRO',
            'MOTORISTA CARRETEIRO III',
            'MOTORISTA CHECK LIST',
            'MOTORISTA DE BITREM',
            'MOTORISTA DE MANUTENCAO',
            'MOTORISTA ENTREGADOR',
            'MOTORISTA INSTRUTOR',
            'MOTORISTA MANOBRA',
            'MOTORISTA TOCO',
            'MOTORISTA TRAINEE',
            'MOTORISTA TRUCK'
          ]
        )
        AND regexp_replace(
          fd."MATRICULA"::text,
          '[^0-9]',
          '',
          'g'
        ) = regexp_replace(
          $1,
          '[^0-9]',
          '',
          'g'
        )
      LIMIT 1
    `;

    const result = await this.kmmDatabaseService.query<MotoristaMatriculaRow>(
      sql,
      [matriculaNormalizada],
    );

    return result.rows[0]?.nome_motorista ?? null;
  }
}
