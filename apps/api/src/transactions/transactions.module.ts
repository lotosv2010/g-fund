import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionConfirmationService } from './transaction-confirmation.service';
import { FundsModule } from '../funds/funds.module';

@Module({
  imports: [FundsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionConfirmationService],
  exports: [TransactionConfirmationService],
})
export class TransactionsModule {}
