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
      homeFeatures: this.site.getHomeFeatures(),
      pages: this.site.getPages(),
      homeFeaturesByTheme: this.site.getHomeFeaturesByTheme(),
      pagesByTheme: this.site.getPagesByTheme(),
      botGroups: this.site.getBotGroups().map((g) => ({
        id: g.id,
        name: g.name,
        isDefault: g.isDefault,
        labelId: g.labelId,
        description: g.description,
        nameCount: g.names.length,
        names: g.names,
        defaultPersonality: g.defaultPersonality,
        namePersonalities: g.namePersonalities,
        winWhuffies: g.winWhuffies,
      })),
      botGroupLabels: this.site.getBotGroupLabels(),
      sounds: this.site.getSounds(),
      avatarPresets: this.site.getAvatarPresets(),
      botChatStarters: this.site.getBotChatStarters(),
    };
  }
}
