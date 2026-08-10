import { Global, Module } from '@nestjs/common';
import { SiteConfigService } from './site-config.service.js';
import { SiteController } from './site.controller.js';

@Global()
@Module({
  controllers: [SiteController],
  providers: [SiteConfigService],
  exports: [SiteConfigService],
})
export class SiteConfigModule {}
