FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache openssl

COPY package*.json ./
COPY packages ./packages
COPY services/subscription-service ./services/subscription-service

RUN npm install
RUN cd packages/database && npx prisma generate
RUN npm run build --workspace=@anomalyze/database
RUN npm run build --workspace=subscription-service

EXPOSE 3005
CMD ["npm", "start", "--workspace=subscription-service"]
