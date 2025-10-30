# Usar imagen oficial de Node.js
FROM node:18-alpine

# Instalar dependencias del sistema para serialport
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    linux-headers \
    udev

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm ci --omit=dev

# Copiar código fuente
COPY . .

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S chafon -u 1001

# Cambiar permisos
RUN chown -R chafon:nodejs /app
USER chafon

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]
