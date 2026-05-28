FROM node:20-alpine
WORKDIR /app
COPY package.json /app/package.json
RUN npm install --omit=dev
COPY server.js /app/server.js
ENV DATA_DIR=/data
EXPOSE 80
CMD ["node","server.js"]
