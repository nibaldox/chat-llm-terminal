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
    return !ticker.includes('-') && ticker.length <= 5;
}

const ALPHA_VANTAGE_API_KEY = 'demo'; // Clave de demostración


// --- REGISTRO DE HERRAMIENTAS ---
export const toolRegistry: Record<string, Tool> = {
  'native_google_search': {
    label: 'Búsqueda Web (Google)',
    declaration: {
      name: 'google_search',
      description: 'Utiliza la Búsqueda de Google para responder preguntas sobre eventos recientes o para encontrar información actualizada en la web.',
      parameters: {
        type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ['query'],
      }
    },
  },
  'get_financial_data': {
    label: 'Obtener Datos Financieros (Acciones y Cripto)',
    declaration: {
      name: 'get_financial_data',
      description: 'Obtiene datos financieros en tiempo real (precio, cambio, volumen) para un ticker de acción o criptomoneda.',
      parameters: {
        type: Type.OBJECT, properties: { ticker: { type: Type.STRING, description: "El ticker del activo, ej. 'AAPL' o 'BTC-USD'."} }, required: ['ticker'],
      },
    },
    execute: async ({ ticker }: { ticker: string }) => {
      const upperTicker = ticker.toUpperCase();
      if (isStockTicker(upperTicker)) {
          const API_URL = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${upperTicker}&apikey=${ALPHA_VANTAGE_API_KEY}`;
          try {
              const response = await fetch(API_URL);
              const data = await response.json();
              const quote = data['Global Quote'];
              if (!quote || Object.keys(quote).length === 0) {
                  return { error: `No se encontraron datos para la acción '${ticker}'. La API puede tener un límite.` };
              }
              return {
                  price: parseFloat(quote['05. price']),
                  change: parseFloat(quote['09. change']),
                  change_percent: quote['10. change percent'],
                  volume: parseInt(quote['06. volume'], 10),
              };
          } catch (error) {
              return { error: `Error al obtener datos para la acción '${ticker}'.` };
          }
      } else {
          const coingeckoId = tickerToCoinGeckoId[upperTicker] || upperTicker.split('-')[0].toLowerCase();
          const API_URL = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`;
          try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error(`API respondió con estado: ${response.status}`);
            const data = await response.json();
            if (!data[coingeckoId]) return { error: `No se encontraron datos para la cripto '${ticker}'.` };
            return {
                price: data[coingeckoId].usd,
                change_24h: data[coingeckoId].usd_24h_change,
                volume_24h: data[coingeckoId].usd_24h_vol,
            };
          } catch (error) {
            return { error: `Error al obtener datos para la cripto '${ticker}'.` };
          }
      }
    },
  },
  'get_historical_data': {
    label: 'Obtener Datos Históricos',
    declaration: {
      name: 'get_historical_data',
      description: 'Obtiene datos de precios históricos (diarios) para un activo financiero.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          asset: { type: Type.STRING, description: "El ticker del activo. Ej: 'AAPL', 'BTC-USD', 'WTI' (Petróleo), 'COPPER' (Cobre)." },
          days: { type: Type.NUMBER, description: "El número de días de datos históricos a obtener." }
        },
        required: ['asset', 'days'],
      },
    },
    execute: async ({ asset, days }: { asset: string, days: number }) => {
      let symbol = asset.toUpperCase();
      let func = 'TIME_SERIES_DAILY';
      
      if (asset.toUpperCase() === 'BTC-USD') { func = 'DIGITAL_CURRENCY_DAILY'; symbol = 'BTC'; } 
      else if (['WTI', 'BRENT'].includes(asset.toUpperCase())) { func = asset.toUpperCase(); } 
      else if (['NATURAL_GAS', 'COPPER', 'ALUMINUM', 'WHEAT', 'CORN', 'COTTON', 'SUGAR', 'COFFEE'].includes(asset.toUpperCase())) { func = asset.toUpperCase(); }

      let apiUrl = `https://www.alphavantage.co/query?apikey=${ALPHA_VANTAGE_API_KEY}&function=${func}`;
      if (func.includes('SERIES') || func.includes('CURRENCY')) apiUrl += `&symbol=${symbol}&market=USD`;
      else apiUrl += '&interval=daily';
      
      try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (data['Error Message'] || data['Note']) throw new Error(data['Error Message'] || data['Note']);
        
        const timeSeriesKey = Object.keys(data).find(k => k.includes('Time Series') || k === 'data');
        if (!timeSeriesKey) throw new Error("No se encontró la clave de series de tiempo en la respuesta.");
        
        const timeSeries = data[timeSeriesKey];
        const dates = Object.keys(timeSeries).slice(0, days).reverse();
        
        return dates.map(date => {
            const dayData = timeSeries[date];
            const closePriceKey = Object.keys(dayData).find(k => k.includes('close') || k.includes('value'));
            return { date, price: parseFloat(dayData[closePriceKey!]) };
        }).filter(item => item && !isNaN(item.price));
      } catch (error: any) {
        return { error: `No se pudieron obtener los datos históricos para ${asset}. ${error.message}` };
      }
    },
  },
  'create_chart': {
    label: 'Crear Gráfico',
    declaration: {
      name: 'create_chart',
      description: 'Crea una visualización de gráfico a partir de datos. Debe llamarse después de obtener los datos con otra herramienta.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          chart_type: { type: Type.STRING, description: "Tipo de gráfico: 'line', 'bar', 'pie'." },
          title: { type: Type.STRING, description: "El título del gráfico." },
          labels: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Etiquetas para el eje X o para las secciones del gráfico." },
          datasets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                data: { type: Type.ARRAY, items: { type: Type.NUMBER } }
              },
              required: ['label', 'data'],
            },
            description: "Los conjuntos de datos a graficar."
          }
        },
        required: ['chart_type', 'title', 'labels', 'datasets'],
      },
    },
    execute: async (args: any) => {
        return { isChartData: true, ...args };
    },
  },
  'get_current_datetime': {
    label: 'Obtener Fecha y Hora Actual',
    declaration: {
      name: 'get_current_datetime',
      description: 'Devuelve la fecha y hora UTC actual en formato ISO 8601.',
      parameters: { type: Type.OBJECT, properties: {}, required: [] },
    },
    execute: async () => new Date().toISOString(),
  },
};
