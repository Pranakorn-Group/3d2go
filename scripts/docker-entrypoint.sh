#!/bin/sh
set -e

# Apply pending migrations before starting the app. Set SKIP_MIGRATIONS=1 to opt out.
if [ "$SKIP_MIGRATIONS" != "1" ]; then
  echo "Running prisma migrate deploy..."
  (cd /opt/migrate && node node_modules/prisma/build/index.js migrate deploy)
fi

exec "$@"
