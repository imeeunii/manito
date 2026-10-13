import { neon } from "@neondatabase/serverless";

type Parameter = string | number | null;
type QueryRows = Record<string, unknown>[];

let client: ReturnType<typeof neon> | undefined;

async function queryRows(sql: string, values: Parameter[]): Promise<QueryRows> {
  const result = (await getClient().query(sql, values)) as QueryRows | { rows?: QueryRows };
  if (Array.isArray(result)) return result;
  return result.rows ?? [];
}

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
          const rows = await queryRows(sql, values);
          return (rows[0] as T | undefined) ?? null;
        },
        async all<T>() {
          const rows = await queryRows(sql, values);
          return { results: rows as T[] };
        },
        async run() {
          await queryRows(sql, values);
        },
      };

      return statement;
    },
  };
}
