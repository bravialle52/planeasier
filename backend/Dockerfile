FROM php:8.3-apache

RUN apt-get update \
    && apt-get install -y libpq-dev git unzip \
    && docker-php-ext-install pdo_pgsql \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

COPY apache.conf /etc/apache2/sites-available/000-default.conf
RUN a2enmod rewrite headers

COPY . /var/www/html
WORKDIR /var/www/html
RUN composer install --no-dev --optimize-autoloader

RUN chown -R www-data:www-data /var/www/html

EXPOSE 80
