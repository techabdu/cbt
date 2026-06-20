#!/bin/sh
# This is the canonical entrypoint for the backend container.
# The working copy lives at backend/docker-entrypoint.sh (within the Docker build context).
# Keep both files in sync.
set -e

if [ -z "${APP_KEY}" ]; then
    APP_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
    export APP_KEY
    echo "==> APP_KEY not set — generated one for this session:"
    echo "    ${APP_KEY}"
    echo "    To make it persistent, add  APP_KEY: \"${APP_KEY}\"  to docker-compose.yml"
fi

echo "==> Waiting for MySQL at ${DB_HOST:-db}:${DB_PORT:-3306}..."
until php -r "
    try {
        new PDO(
            'mysql:host=${DB_HOST:-db};port=${DB_PORT:-3306};dbname=${DB_DATABASE}',
            '${DB_USERNAME}', '${DB_PASSWORD}'
        );
        exit(0);
    } catch (Exception \$e) { exit(1); }
" 2>/dev/null; do
    printf '.'
    sleep 2
done
echo ""
echo "==> MySQL is ready."

echo "==> Running migrations..."
php artisan migrate --force

echo "==> Caching config, routes, views..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "==> Starting PHP-FPM..."
exec php-fpm
