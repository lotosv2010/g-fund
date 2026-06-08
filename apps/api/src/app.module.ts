import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { FundsModule } from './funds/funds.module';
import { PositionsModule } from './positions/positions.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '../../../.env'), '.env'],
    }),
    DbModule,
    FundsModule,
    PositionsModule,
    TransactionsModule,
  ],
})
export class AppModule {}
