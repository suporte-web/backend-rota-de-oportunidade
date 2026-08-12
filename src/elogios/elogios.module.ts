import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { KmmModule } from '../kmm/kmm.module';
import { ElogiosController } from './elogios.controller';
import { ElogiosService } from './elogios.service';
import { CommonServicesModule } from '@/common/services/common-services.module';

@Module({
  imports: [AdminModule, KmmModule, CommonServicesModule],
  controllers: [ElogiosController],
  providers: [ElogiosService],
  exports: [ElogiosService],
})
export class ElogiosModule {}
