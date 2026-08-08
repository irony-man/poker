import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from '@poker/db';
import { TypeOrmConfigService } from './typeorm-config.service.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
    }),
    TypeOrmModule.forFeature([...ALL_ENTITIES]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
