FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache openssl

COPY package*.json ./
COPY packages ./packages
COPY services/notification-service ./services/notification-service

RUN npm install
RUN cd packages/database && npx prisma generate
RUN npm run build --workspace=@anomalyze/database
RUN npm run build --workspace=notification-service

EXPOSE 3004
CMD ["npm", "start", "--workspace=notification-service"]
