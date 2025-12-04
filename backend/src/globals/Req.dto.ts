import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { Request } from 'express';

export class Crequest extends Request {
  cookies: {
    jwt?: string;
  };
}

export class Irequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

export class Grequest extends Request {
  user: {
    email: string | undefined;
    name: string | undefined;
    picture: string | undefined;
    provider: string | undefined;
  };
}

export class paginationQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 20;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;
}
