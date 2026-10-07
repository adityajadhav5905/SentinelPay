FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache openssl

COPY package*.json ./
COPY packages ./packages
COPY services/analytics-service ./services/analytics-service

RUN npm install
RUN cd packages/database && npx prisma generate
RUN npm run build --workspace=@anomalyze/database
RUN npm run build --workspace=analytics-service

EXPOSE 3001
CMD ["npm", "start", "--workspace=analytics-service"]
