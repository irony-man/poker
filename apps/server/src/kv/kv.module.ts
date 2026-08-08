import { Module } from '@nestjs/common';
import { KvService } from './kv.service.js';

@Module({
  providers: [KvService],
  exports: [KvService],
})
export class KvModule {}
