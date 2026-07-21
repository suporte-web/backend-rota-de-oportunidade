import { Module } from '@nestjs/common';
import { GeoService } from './geo.service';
import { TextService } from './text.service';

@Module({
  providers: [
    GeoService,
    TextService,
  ],
  exports: [
    GeoService,
    TextService,
  ],
})
export class CommonServicesModule {}