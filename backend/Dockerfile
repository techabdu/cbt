# ── Stage 1: Install & autoload Composer dependencies ─────────────────────
FROM composer:2 AS build

WORKDIR /app

# Copy everything so scripts that reference app files work
COPY . .

RUN composer install \
        --no-dev \
        --no-interaction \
        --optimize-autoloader \
        --classmap-authoritative \
        --prefer-dist \
    && composer dump-autoload \
        --no-dev \
        --classmap-authoritative \
        --optimize

# ── Stage 2: Production PHP-FPM runtime ────────────────────────────────────
FROM php:8.3-fpm-alpine

# PHP extensions required by Laravel 11 + dompdf + maatwebsite/excel
RUN apk add --no-cache \
        libzip-dev \
        icu-dev \
        freetype-dev \
        libjpeg-turbo-dev \
        libpng-dev \
        libxml2-dev \
    && docker-php-ext-configure gd \
        --with-freetype \
        --with-jpeg \
    && docker-php-ext-install \
        pdo_mysql \
        bcmath \
        zip \
        intl \
        gd \
        opcache \
        pcntl \
        xml \
        soap \
    && rm -rf /var/cache/apk/*

# OPcache tuned for production
RUN { \
    echo "opcache.enable=1"; \
    echo "opcache.memory_consumption=256"; \
    echo "opcache.max_accelerated_files=20000"; \
    echo "opcache.validate_timestamps=0"; \
    echo "opcache.jit_buffer_size=100M"; \
    echo "opcache.jit=1255"; \
} > /usr/local/etc/php/conf.d/opcache.ini

WORKDIR /var/www/html

# Copy fully-built application from stage 1
COPY --from=build --chown=www-data:www-data /app .

# Ensure writable directories exist with correct ownership
RUN mkdir -p \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache \
    && chmod +x /var/www/html/docker-entrypoint.sh

EXPOSE 9000

ENTRYPOINT ["/var/www/html/docker-entrypoint.sh"]
