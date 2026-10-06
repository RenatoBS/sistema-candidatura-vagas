import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@scv/contracts';

import { Publico } from '../http/decoradores';

@Controller('health')
export class HealthController {
  @Publico()
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      version: process.env.npm_package_version ?? '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
