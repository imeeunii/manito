# 우리 반 마니또

Next.js 앱입니다. 교사는 반을 만들고 활동을 관리하며, 학생은 자신의 마니또를 확인하고 친구의 장점 세 가지와 이름 삼행시를 모두 남깁니다.

## 로컬 실행

Node.js 22 이상이 필요합니다.

1. `pnpm install --frozen-lockfile`
2. Neon PostgreSQL 데이터베이스를 만들고 SQL Editor에서 [`db/schema.sql`](db/schema.sql)을 실행합니다. 이전 버전의 테이블이 있어도 장점과 삼행시 열이 추가됩니다.
3. 프로젝트 루트에 `.env.local`을 만들고 `DATABASE_URL=...`을 넣습니다. 이 파일은 Git에 올라가지 않습니다.
4. `pnpm dev`로 실행합니다.

`pnpm build`로 배포 빌드를 확인할 수 있습니다.

## Vercel 배포

1. 이 저장소의 최신 변경을 GitHub에 올립니다.
2. Vercel에서 **Add New > Project**로 GitHub 저장소 `imeeunii/manito`를 가져옵니다. Framework Preset은 **Next.js**, Root Directory는 저장소 루트로 둡니다.
3. Vercel 프로젝트의 **Storage**에서 Neon을 연결하거나 별도 Neon 프로젝트를 만듭니다. Neon의 SQL Editor에서 [`db/schema.sql`](db/schema.sql)을 한 번 실행합니다.
4. Vercel 프로젝트의 **Settings > Environment Variables**에 `DATABASE_URL`을 설정합니다. Neon 연동이 자동으로 넣었다면 실제로 `DATABASE_URL`이 있는지만 확인합니다. Production과 Preview를 모두 사용한다면 각 환경에 지정합니다.
5. 배포를 실행하고 기본으로 발급되는 `*.vercel.app` 주소에서 반 생성, 학생 조회, 장점 세 가지와 삼행시 저장, 활동 종료를 확인합니다. 개인 도메인은 필요하지 않습니다.

데이터는 PostgreSQL에 저장됩니다. Vercel의 서버 함수가 다시 시작되어도 반 기록이 유지됩니다. 이전 Cloudflare D1 데이터는 옮기지 않으므로 새 배포는 빈 데이터베이스에서 시작합니다.
