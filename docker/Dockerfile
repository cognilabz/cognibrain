FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 8787

CMD ["npm", "run", "dev"]
