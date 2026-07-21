import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface CidadeEstado {
  cidade: string | null;
  estado: string | null;
}

interface NominatimResponse {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
  };
}

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  async getCidadeEstado(
    latitude: string | number,
    longitude: string | number,
  ): Promise<CidadeEstado> {
    try {
      const response =
        await axios.get<NominatimResponse>(
          'https://nominatim.openstreetmap.org/reverse',
          {
            params: {
              format: 'json',
              lat: latitude,
              lon: longitude,
            },
            headers: {
              'User-Agent': 'Projeto-Elogios/1.0',
            },
            timeout: 5000,
          },
        );

      const address = response.data?.address ?? {};

      return {
        cidade:
          address.city ??
          address.town ??
          address.village ??
          address.municipality ??
          null,
        estado: address.state ?? null,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erro desconhecido';

      this.logger.warn(
        `[Geo] Não foi possível buscar cidade/estado: ${message}`,
      );

      return {
        cidade: null,
        estado: null,
      };
    }
  }
}