import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { DatabaseModule } from '../database/database.module';
import { KmmModule } from '../kmm/kmm.module';
import { ElogiosController } from './elogios.controller';
import { ElogiosService } from './elogios.service';
import { CommonServicesModule } from '@/common/services/common-services.module';
import { ElogiosRepository } from './elogios.repository';

@Module({
  imports: [DatabaseModule, AdminModule, KmmModule, CommonServicesModule],
  controllers: [ElogiosController],
  providers: [ElogiosService, ElogiosRepository],
  exports: [ElogiosService],
})
export class ElogiosModule {}
