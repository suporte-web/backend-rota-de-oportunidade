import { Module } from '@nestjs/common';
import { KmmDatabaseModule } from '../database/kmm/kmm-database.module';
import { KmmService } from './kmm.service';
import { TextService } from '@/common/services/text.service';

@Module({
  imports: [
    KmmDatabaseModule,
  ],
  providers: [
    KmmService,
    TextService,
  ],
  exports: [
    KmmService,
  ],
})
export class KmmModule {}