# Local Laravel container (used by Docker Compose): PHP 8.4 + the built-in
# server with multiple workers. Simple and reliable for running/sharing the
# project locally; swap in nginx/FrankenPHP if you later need higher concurrency.
FROM php:8.4-cli

# Reliable extension installer (pulls the system libs each ext needs).
ADD --chmod=0755 https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/
# pdo_mysql → MySQL; mbstring/gd/zip/intl/bcmath cover Laravel plus the
# dompdf (PDF) and maatwebsite/excel (Excel) result exports.
RUN install-php-extensions pdo_mysql mbstring gd zip bcmath intl

# Composer + git/unzip for dependency installs.
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
RUN apt-get update && apt-get install -y --no-install-recommends git unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN composer install --no-dev --no-interaction --optimize-autoloader --no-progress

# Let the built-in server handle concurrent requests.
ENV PHP_CLI_SERVER_WORKERS=4

EXPOSE 8000
CMD ["sh", "docker/start.sh"]
