import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { envOu } from '@scv/env';

let sdk: NodeSDK | undefined;

export function initTelemetry(): void {
  if (process.env.OTEL_ENABLED !== 'true') {
    return;
  }

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

  sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({
      url: envOu(process.env, 'OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318/v1/traces'),
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
}

export async function shutdownTelemetry(): Promise<void> {
  await sdk?.shutdown();
}
