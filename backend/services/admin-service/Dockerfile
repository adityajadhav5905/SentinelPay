FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache openssl

COPY package*.json ./
COPY packages ./packages
COPY services/admin-service ./services/admin-service

RUN npm install
RUN cd packages/database && npx prisma generate
RUN npm run build --workspace=@anomalyze/database
RUN npm run build --workspace=admin-service

EXPOSE 3005
CMD ["npm", "start", "--workspace=admin-service"]
