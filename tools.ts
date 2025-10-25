import { FunctionDeclaration, Type } from "@google/genai";

export interface Tool {
  label: string;
  declaration: FunctionDeclaration;
  // La ejecución es opcional, ya que algunas herramientas como la búsqueda son nativas.
  execute?: (args: any) => Promise<any>;
}

// Mapeo de tickers comunes a IDs de CoinGecko
const tickerToCoinGeckoId: Record<string, string> = {
  'BTC-USD': 'bitcoin',
  'ETH-USD': 'ethereum',
  'SOL-USD': 'solana',
  'XRP-USD': 'ripple',
  'DOGE-USD': 'dogecoin',
  'ADA-USD': 'cardano',
};

const isStockTicker = (ticker: string) => {
    // Heurística simple: los tickers de acciones suelen ser más cortos y no contienen '-'
    return !ticker.includes('-') && ticker.length <= 5;
}


// --- REGISTRO DE HERRAMIENTAS ---
// Aquí es donde defines todas las herramientas disponibles para los agentes.

export const toolRegistry: Record<string, Tool> = {
  'native_google_search': {
    label: 'Búsqueda Web (Google)',
    declaration: {
      name: 'google_search',
      description: 'Utiliza la Búsqueda de Google para responder preguntas sobre eventos recientes o para encontrar información actualizada en la web.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: "La consulta de búsqueda.",
          },
        },
        required: ['query'],
      }
    },
    // No hay 'execute' porque esta herramienta es manejada nativamente por la API de Gemini
  },
  'get_financial_data': {
    label: 'Obtener Datos Financieros (Cripto en Vivo)',
    declaration: {
      name: 'get_financial_data',
      description: 'Obtiene datos financieros en tiempo real (precio, cambio 24h, volumen) para un ticker de criptomoneda.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          ticker: {
            type: Type.STRING,
            description: "El ticker de la criptomoneda, ej. 'BTC-USD' para Bitcoin.",
          },
        },
        required: ['ticker'],
      },
    },
    execute: async ({ ticker }: { ticker: string }) => {
      console.log(`[Herramienta] Ejecutando get_financial_data con ticker: ${ticker}`);
      const upperTicker = ticker.toUpperCase();

      if (isStockTicker(upperTicker)) {
          return { error: `Lo siento, actualmente solo puedo obtener datos en tiempo real para criptomonedas (ej. BTC-USD). El soporte para acciones no está implementado.` };
      }

      const coingeckoId = tickerToCoinGeckoId[upperTicker] || upperTicker.split('-')[0].toLowerCase();
      
      const API_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`;

      try {
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`La API de CoinGecko respondió con el estado: ${response.status}`);
        }
        const data = await response.json();

        if (!data[coingeckoId]) {
          return { error: `No se pudieron encontrar datos para el ticker '${ticker}' en la API de CoinGecko. Por favor, intenta con un ticker conocido como BTC-USD o ETH-USD.` };
        }

        const result = {
            price: data[coingeckoId].usd,
            change_24h: data[coingeckoId].usd_24h_change,
            volume_24h: data[coingeckoId].usd_24h_vol,
            currency: 'USD'
        };
        
        return result;

      } catch (error) {
        console.error(`[Error de Herramienta] Fallo al llamar a la API de CoinGecko:`, error);
        return { error: `Ocurrió un error al contactar el servicio de datos financieros. Inténtalo de nuevo más tarde.` };
      }
    },
  },
  'get_current_datetime': {
    label: 'Obtener Fecha y Hora Actual',
    declaration: {
      name: 'get_current_datetime',
      description: 'Devuelve la fecha y hora UTC actual en formato ISO 8601.',
      parameters: {
        type: Type.OBJECT,
        properties: {},
        required: [],
      },
    },
    execute: async () => {
      console.log(`[Herramienta] Ejecutando get_current_datetime`);
      return new Date().toISOString();
    },
  },
};