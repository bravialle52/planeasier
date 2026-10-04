FROM php:8.3-apache

RUN apt-get update \
    && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo_pgsql \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*

COPY apache.conf /etc/apache2/sites-available/000-default.conf
RUN a2enmod rewrite headers

COPY . /var/www/html
RUN mkdir -p /var/www/html/uploads && chown -R www-data:www-data /var/www/html/uploads

EXPOSE 80
