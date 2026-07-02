# Production-capable backend image: nginx + PHP-FPM (OPcache + Redis) plus a
# queue-worker pool, all under supervisor. This replaces the old
# `php artisan serve` (~4 concurrent requests) which could not approach the
# 5,000-concurrent-student target. The same image runs the online staff portal
# and the offline exam server (behaviour switches on env, not on the image).
FROM php:8.4-fpm

# Reliable extension installer (pulls the system libs each ext needs).
ADD --chmod=0755 https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/
# pdo_mysql → MySQL; redis → cache/session/queue/locks; opcache → bytecode cache;
# pcntl → graceful queue-worker signal handling; mbstring/gd/zip/intl/bcmath
# cover Laravel plus dompdf (PDF) and maatwebsite/excel (Excel) result exports.
RUN install-php-extensions pdo_mysql redis opcache pcntl mbstring gd zip bcmath intl

# nginx + supervisor for the multi-process container; git/unzip for Composer.
RUN apt-get update && apt-get install -y --no-install-recommends \
        nginx supervisor git unzip \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

# Composer.
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# PHP / FPM / OPcache tuning, the nginx main config (raises worker_connections
# past the stock 768 — required for ~1000 keepalive exam clients) + site, and
# the process supervisor config.
COPY docker/php.ini           /usr/local/etc/php/conf.d/zz-cbt.ini
COPY docker/opcache.ini       /usr/local/etc/php/conf.d/zz-opcache.ini
COPY docker/php-fpm.pool.conf /usr/local/etc/php-fpm.d/zz-cbt.conf
COPY docker/nginx-main.conf   /etc/nginx/nginx.conf
COPY docker/nginx.conf        /etc/nginx/conf.d/default.conf
COPY docker/supervisord.conf  /etc/supervisor/conf.d/cbt.conf

WORKDIR /app
COPY . .

RUN composer install --no-dev --no-interaction --optimize-autoloader --no-progress \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 80
CMD ["sh", "docker/start.sh"]
