import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { ElogiosModule } from './elogios/elogios.module';
import { KmmDatabaseModule } from './database/kmm/kmm-database.module';
import { ConfigModule } from '@nestjs/config';
import { KmmModule } from './kmm/kmm.module';
import { PrismaModule } from './database/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    AdminModule,
    ElogiosModule,
    KmmDatabaseModule,
    KmmModule,
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
