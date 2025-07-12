FROM node:20-alpine
WORKDIR /usr/src/app

# Copy the **existing** file (analyzer.js) and lockfile
COPY package*.json ./

RUN npm install --production

COPY analyzer.js ./

CMD ["node", "analyzer.js"]
