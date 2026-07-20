export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class SimClock implements Clock {
  private readonly fixed: Date;
  constructor(iso: string) {
    this.fixed = new Date(iso);
  }
  now(): Date {
    return this.fixed;
  }
}

/** Only place outside SystemClock allowed to construct Dates from strings. */
export function parseIso(iso: string): Date {
  return new Date(iso);
}

export function dayOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Clock from AIOS_NOW env (deterministic runs) or system time. */
export function clockFromEnv(env: NodeJS.ProcessEnv): Clock {
  const fixed = env.AIOS_NOW;
  return fixed ? new SimClock(fixed) : new SystemClock();
}
