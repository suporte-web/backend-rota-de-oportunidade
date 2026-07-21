import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client/extension';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();

      this.logger.log(
        'Conexão com o Prisma estabelecida com sucesso.',
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erro desconhecido';

      this.logger.error(
        `Erro ao conectar com o Prisma: ${message}`,
      );

      throw error;
    }
  }

  async checkConnection() {
    return this.$queryRaw<Array<{ ok: number }>>`
      SELECT 1 AS ok
    `;
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Encerrando conexão com o Prisma...');

    await this.$disconnect();
  }
}