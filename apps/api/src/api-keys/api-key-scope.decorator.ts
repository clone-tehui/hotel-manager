import { SetMetadata } from '@nestjs/common';

export const API_KEY_SCOPE = 'hotel:api-key-scope';
export const ApiKeyScope = (scope: string) => SetMetadata(API_KEY_SCOPE, scope);
