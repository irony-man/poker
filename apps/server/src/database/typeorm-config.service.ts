import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { buildTypeOrmOptions } from '@poker/db';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  async createTypeOrmOptions(): Promise<TypeOrmModuleOptions> {
    const url = this.config.get<string>('DATABASE_URL')?.trim();
    if (!url) {
      throw new Error('DATABASE_URL is required');
    }
    // Match prior DDL-on-boot: keep schema aligned with entities.
    const synchronize = this.config.get<string>('TYPEORM_SYNC') !== 'false';
    const options = await buildTypeOrmOptions({
      connectionString: url,
      synchronize,
      logging: this.config.get<string>('TYPEORM_LOGGING') === 'true',
    });
    return options;
  }
}
