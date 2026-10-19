import { ArgumentsHost, Catch, ConflictException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';

/**
 * Turns unique-constraint violations into 409s. The services check for duplicates first, but two requests at the same
 * moment can both pass that check, and then the database constraint is what stops the second one. Every other database
 * error goes to Nest's default handler: logged on the server, answered with a plain "Internal server error".
 */
@Catch(QueryFailedError)
export class DbErrorFilter extends BaseExceptionFilter {
  catch(e: QueryFailedError & { driverError?: { code?: string; constraint?: string; detail?: string } }, host: ArgumentsHost) {
    const d = e.driverError;
    if (d?.code !== '23505') return super.catch(e, host);
    const message = d.constraint === 'one_account_manager_per_org' ? 'This organisation already has an Account Manager.'
      : d.detail?.includes('(email)') ? 'An account with this email already exists.'
      : 'That record already exists. Refresh and try again.';
    return super.catch(new ConflictException(message), host);
  }
}
