/**
 * 🔍 Logger Centralizado da Aplicação
 *
 * Utiliza console em desenvolvimento e pode ser estendido para
 * integração com serviços como Sentry, LogRocket, etc.
 *
 * Uso:
 *   import { logger } from '../lib/logger'
 *   logger.info('Mensagem', { context: 'valor' })
 *   logger.error('Erro', new Error('msg'), { userId: '123' })
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDev = import.meta.env.DEV;
  private isProduction = import.meta.env.PROD;

  /**
   * Log de debug (apenas desenvolvimento)
   */
  debug(message: string, context?: LogContext) {
    if (this.isDev) {
      console.debug(`[DEBUG] ${message}`, context || "");
    }
  }

  /**
   * Log informativo
   */
  info(message: string, context?: LogContext) {
    console.info(`✅ [INFO] ${message}`, context || "");
    this.captureToServer("info", message, context);
  }

  /**
   * Log de aviso
   */
  warn(message: string, context?: LogContext) {
    console.warn(`⚠️  [WARN] ${message}`, context || "");
    this.captureToServer("warn", message, context);
  }

  /**
   * Log de erro crítico
   */
  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`❌ [ERROR] ${message}`, {
      error: errorMessage,
      stack: errorStack,
      ...context,
    });

    this.captureToServer("error", message, {
      error: errorMessage,
      stack: errorStack,
      ...context,
    });
  }

  /**
   * Log estruturado com performance tracking
   */
  performance(label: string, duration: number, context?: LogContext) {
    const level = duration > 3000 ? "warn" : "info";
    const emoji = duration > 3000 ? "🐌" : "⚡";

    console[level](
      `${emoji} [PERF] ${label}: ${duration.toFixed(2)}ms`,
      context || "",
    );
  }

  /**
   * Capturar logs para servidor (em produção)
   * Integrado com Sentry para monitoramento de erros
   */
  private captureToServer(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ) {
    if (this.isProduction && level !== "debug") {
      // Integração com Sentry (inicializado em main.tsx)
      if (typeof window !== "undefined" && (window as any).Sentry) {
        const Sentry = (window as any).Sentry;
        if (level === "error") {
          Sentry.captureException(new Error(message), { extra: context });
        } else {
          Sentry.captureMessage(message, level as any, { extra: context });
        }
      }
    }
  }
}

// Instância singleton
export const logger = new Logger();

/**
 * Hook para performance tracking
 *
 * Uso:
 *   const { startTimer, endTimer } = usePerformanceTimer()
 *   startTimer('loadData')
 *   // ... fazer algo
 *   endTimer('loadData')  // Loga tempo automaticamente
 */
export function usePerformanceTimer() {
  const timers = new Map<string, number>();

  return {
    startTimer: (label: string) => {
      timers.set(label, performance.now());
    },
    endTimer: (label: string) => {
      const start = timers.get(label);
      if (start) {
        const duration = performance.now() - start;
        logger.performance(label, duration);
        timers.delete(label);
      }
    },
  };
}

// Export para debugging global em dev mode
if (import.meta.env.DEV) {
  const w = globalThis as any;
  w.__logger = logger;
  // Performance timer deve ser usado dentro de componentes React
  w.__perfTimer = {
    start: (label: string) => {
      performance.mark(`${label}-start`);
    },
    end: (label: string) => {
      performance.mark(`${label}-end`);
      const measure = performance.measure(
        label,
        `${label}-start`,
        `${label}-end`,
      );
      logger.performance(label, measure.duration);
    },
  };
}
