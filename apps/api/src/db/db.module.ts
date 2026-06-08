import { Module, Global, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@g-fund/db';
import { runMigrations } from '@g-fund/db';

export const DB = Symbol('DB');

@Injectable()
class MigrationRunner implements OnApplicationBootstrap {
  constructor(private readonly config: ConfigService) {}

  async onApplicationBootstrap() {
    await runMigrations(this.config.get<string>('DATABASE_URL')!);
  }
}

@Global()
@Module({
  providers: [
    MigrationRunner,
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const pool = new Pool({ connectionString: config.get<string>('DATABASE_URL') });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
