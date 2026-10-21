   const DAY = 86_400_000;

   export const daysFromNow = (n: number) =>
     new Date(Date.now() + n * DAY).toISOString().slice(0, 10);

   export const daysUntil = (iso: string) =>
     Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);