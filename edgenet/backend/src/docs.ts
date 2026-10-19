import { applyDecorators, INestApplication } from '@nestjs/common';
import { ApiOperation, ApiResponse, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// OpenAPI docs, served at /api/docs. Request bodies and query parameters are read from the DTO classes by the
// @nestjs/swagger compiler plugin (nest-cli.json); the decorators below add what the code cannot say by itself.

const ERRORS = {
  400: 'Invalid input, or information the action needs is missing. `message` says what.',
  401: 'No token, or the token is invalid or expired.',
  403: 'Your role, or your assignment to this request, does not allow this.',
  404: 'Not found in your organisation.',
  409: 'Conflicts with the current state (for example an invalid stage move, a clash, or a concurrent change).',
} as const;
type Code = keyof typeof ERRORS;

/** Summary, who may call it, the errors it can return, and optional examples of a success and of one error. */
export function Doc(summary: string, o: {
  who?: string; description?: string; errors?: Code[];
  ok?: { status?: number; example: unknown }; error?: { status: Code; example: unknown };
} = {}) {
  const description = [o.who && `**Who:** ${o.who}`, o.description].filter(Boolean).join('\n\n') || undefined;
  return applyDecorators(
    ApiOperation({ summary, description }),
    ...(o.ok ? [ApiResponse({ status: o.ok.status ?? 200, description: 'Success', schema: { example: o.ok.example } })] : []),
    ...(o.errors ?? []).map((status) => ApiResponse({
      status, description: ERRORS[status], ...(o.error?.status === status ? { schema: { example: o.error.example } } : {}),
    })),
  );
}

/** Served unless NODE_ENV is production; set API_DOCS=true to serve them there too. */
export function setupDocs(app: INestApplication) {
  if (process.env.NODE_ENV === 'production' && process.env.API_DOCS !== 'true') return;
  const config = new DocumentBuilder()
    .setTitle('EdgeNet PoC Request Portal API')
    .setDescription([
      'All routes are under `/api`. Except register and login, every route needs `Authorization: Bearer <token>` from login.',
      'Everything is scoped to the caller\'s organisation. Errors have the shape `{ statusCode, message, error }`.',
      'Examples use fictional data.',
    ].join('\n\n'))
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
}
