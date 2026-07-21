import { Injectable } from '@nestjs/common';
import moment from 'moment-timezone';

@Injectable()
export class TextService {
  getDataAtual(): string {
    return moment()
      .tz('America/Sao_Paulo')
      .format('YYYY-MM-DD HH:mm:ss');
  }

  onlyDigits(value: unknown): string {
    return String(value ?? '').replace(/\D/g, '');
  }

  normalizaCarreta(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }
}