FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=2s --retries=6 CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["npm","start"]
