import { Controller, Get, Post, Body, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AnalysisService } from './analysis.service';

interface StreamEvent {
  event: string;
  data: string;
}

@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Sse('stream')
  stream(@Query('query') query: string): Observable<StreamEvent> {
    return this.analysisService.stream(query);
  }

  @Post('invoke')
  invoke(@Body('query') query: string) {
    return this.analysisService.invoke(query);
  }
}
