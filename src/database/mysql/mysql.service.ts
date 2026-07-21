import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPool,
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';

export type MysqlParam = string | number | boolean | Date | Buffer | null;

@Injectable()
export class MysqlService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MysqlService.name);
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.getOrThrow<string>('MYSQL_HOST');
    const user = this.configService.getOrThrow<string>('MYSQL_USER');
    const password = this.configService.getOrThrow<string>('MYSQL_PASSWORD');
    const database = this.configService.getOrThrow<string>('MYSQL_DATABASE');

    const port = Number(this.configService.get<string>('MYSQL_PORT') ?? 3306);

    if (!Number.isInteger(port) || port <= 0) {
      throw new Error(
        `MYSQL_PORT inválida: "${this.configService.get<string>(
          'MYSQL_PORT',
        )}".`,
      );
    }

    this.logger.log(
      `[MySQL] Configurando conexão: ${host}:${port}/${database} - usuário: ${user}`,
    );

    this.pool = createPool({
      host,
      user,
      password,
      database,
      port,

      ssl: undefined,

      timezone: this.configService.get<string>('MYSQL_TIMEZONE') ?? '-03:00',

      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,

      supportBigNumbers: true,
      bigNumberStrings: true,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.checkConnection();

      this.logger.log('Conexão com o banco MySQL estabelecida com sucesso.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro desconhecido';

      this.logger.error(`Erro ao conectar com o banco MySQL: ${message}`);

      /*
       * Caso o MySQL seja obrigatório para a aplicação,
       * utilize:
       *
       * throw error;
       */
    }
  }

  async query<T extends RowDataPacket[]>(
    sql: string,
    params: MysqlParam[] = [],
  ): Promise<T> {
    const [rows] = await this.pool.query<T>(sql, params);

    return rows;
  }

  async execute(
    sql: string,
    params: MysqlParam[] = [],
  ): Promise<ResultSetHeader> {
    const [result] = await this.pool.execute<ResultSetHeader>(sql, params);

    return result;
  }

  async getConnection(): Promise<PoolConnection> {
    return this.pool.getConnection();
  }

  async checkConnection() {
    return this.query<RowDataPacket[]>('SELECT 1 AS ok');
  }

  getPool(): Pool {
    return this.pool;
  }

  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Encerrando conexão com o banco MySQL...');

    await this.pool.end();
  }
}
