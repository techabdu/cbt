#!/bin/sh
# Container start (Docker Compose). Recreate the storage skeleton (a freshly
# mounted volume starts empty and would otherwise hide these folders), wait for
# the database, apply migrations, seed bootstrap data on the very first run,
# then serve.
set -e

mkdir -p \
  storage/app/private \
  storage/app/public \
  storage/framework/cache/data \
  storage/framework/sessions \
  storage/framework/views \
  storage/logs

# The storage volume mounts over the image's copy, so (re)apply ownership at
# runtime — the PHP-FPM workers run as www-data and must be able to write here.
chown -R www-data:www-data storage bootstrap/cache || true

# Wait for the database to accept TCP connections. Compose's healthcheck +
# depends_on usually covers this, but retry so a cold start never races the DB.
echo ">> waiting for database ${DB_HOST:-db}:${DB_PORT:-3306} ..."
i=0
until php -r 'exit(@fsockopen(getenv("DB_HOST")?:"db", (int)(getenv("DB_PORT")?:3306)) ? 0 : 1);' 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "!! database not reachable after 60s, giving up"
    exit 1
  fi
  sleep 1
done

php artisan migrate --force

# Seed bootstrap data once: system settings, the college, and the super-admin
# account (file number ADMIN/0001, password "password" — forced to change on
# first login). Guard on a sentinel that lives on the persistent storage volume
# so restarts never re-seed. To reset everything, run `docker compose down -v`.
if [ ! -f storage/app/.seeded ]; then
  echo ">> first run: seeding bootstrap data ..."
  php artisan db:seed --force
  touch storage/app/.seeded
fi

# Cache config, routes and events so each request skips re-parsing them. Re-run
# every boot so the cache always reflects the current environment.
php artisan optimize

# nginx + PHP-FPM + the grading queue workers, supervised in the foreground.
exec supervisord -c /etc/supervisor/conf.d/cbt.conf
