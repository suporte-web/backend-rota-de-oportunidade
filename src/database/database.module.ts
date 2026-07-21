import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MysqlService } from './mysql/mysql.service';
// import { KmmDatabaseService } from './kmm/kmm-database.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    // KmmDatabaseService,
    MysqlService,
    // PrismaService,
  ],
  exports: [
    // KmmDatabaseService,
    MysqlService,
    // PrismaService,
  ],
})
export class DatabaseModule {}