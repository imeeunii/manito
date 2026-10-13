import { neon } from "@neondatabase/serverless";

type Parameter = string | number | null;

let client: ReturnType<typeof neon> | undefined;

function getClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다. Vercel 환경 변수를 확인해 주세요.");
  }
  client ??= neon(databaseUrl);
  return client;
}

// Keep the API's existing prepared-statement calls while using PostgreSQL parameters.
export function getDatabase() {
  return {
    prepare(query: string) {
      let index = 0;
      const sql = query.replace(/\?/g, () => `$${++index}`);
      let values: Parameter[] = [];

      const statement = {
        bind(...parameters: Parameter[]) {
          values = parameters;
          return statement;
        },
        async first<T>() {
          const rows = await getClient().query(sql, values);
          return (rows[0] as T | undefined) ?? null;
        },
        async all<T>() {
          const rows = await getClient().query(sql, values);
          return { results: rows as T[] };
        },
        async run() {
          await getClient().query(sql, values);
        },
      };

      return statement;
    },
  };
}
