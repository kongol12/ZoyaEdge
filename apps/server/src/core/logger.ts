/**
 * Lightweight structured logger for ZoyaEdge Production.
 * Outputs JSON logs in production, and standard logs in development.
 */

const isProduction = process.env.NODE_ENV === 'production';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  message: string;
  level: LogLevel;
  timestamp: string;
  context?: any;
}

function log(level: LogLevel, message: string, context?: any) {
  const payload: LogPayload = {
    message,
    level,
    timestamp: new Date().toISOString(),
    ...(context && { context })
  };

  if (isProduction) {
    // In production we ONLY log JSON for structured logging/observability
    console.log(JSON.stringify(payload));
  } else {
    // Development readability
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    const color = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : '\x1b[32m';
    console.log(`${color}[${level.toUpperCase()}]\x1b[0m ${message}${contextStr}`);
  }
}

export const logger = {
  info: (msg: string, ctx?: any) => log('info', msg, ctx),
  warn: (msg: string, ctx?: any) => log('warn', msg, ctx),
  error: (msg: string, ctx?: any) => {
    // We strip error stacks in production logs to stay clean and generic
    const sanitizedCtx = ctx instanceof Error 
      ? { message: ctx.message, code: (ctx as any).code } 
      : ctx;
    log('error', msg, sanitizedCtx);
  },
  debug: (msg: string, ctx?: any) => !isProduction && log('debug', msg, ctx),
};
