import { Controller, Get } from '@nestjs/common';
import { SiteConfigService } from './site-config.service.js';

/** Public site metadata (announcement banner). No auth. */
@Controller('api/site')
export class SiteController {
  constructor(private readonly site: SiteConfigService) {}

  @Get()
  getSite() {
    const announcement = this.site.getAnnouncement();
    return {
      announcement: {
        enabled: announcement.enabled && announcement.text.trim().length > 0,
        text: announcement.text,
      },
    };
  }
}
