FROM node:20-alpine
WORKDIR /app

# install only prod deps for a small image
COPY package*.json ./
RUN npm ci --omit=dev

# copy source
COPY . .

# configure and expose port
ENV PORT=3000
EXPOSE 3000

# start the API (change path if your entry is different)
CMD ["node","src/index.js"]
